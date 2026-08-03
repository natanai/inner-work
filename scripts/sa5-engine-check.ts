import assert from 'node:assert/strict'
import { needs, strategies, type NeedCard, type StrategyCard } from '../src/data/cards.ts'
import { encodeCommit } from '../src/tabletop/commitSelection.ts'
import { continueRound, createGame, resolveRound, type NeedSlot } from '../src/tabletop/model.ts'
import { enabledSpecialActionIds, specialActionById } from '../src/tabletop/specialActions.ts'

function need(id: string): NeedCard {
  const card = needs.find((item) => item.id === id)
  assert(card, `Missing Need card ${id}`)
  return card
}

function strategy(id: string): StrategyCard {
  const card = strategies.find((item) => item.id === id)
  assert(card, `Missing Strategy card ${id}`)
  return card
}

function slot(card: NeedCard): NeedSlot {
  return {
    card,
    gifts: 1,
    setup: { base: 1, situation: 0, multiplied: false, total: 1 },
  }
}

assert.deepEqual(enabledSpecialActionIds, ['SA5'], 'The isolated branch must enable only SA5.')

const special = specialActionById('SA5')
assert(special, 'Effective Communication must exist in the complete catalog.')

const understandingStrategy = strategy('ST27')
assert(
  understandingStrategy.effects.some((effect) => effect.need === 'Understanding' && effect.amount > 0),
  'The paired Strategy must have a positive Understanding effect.',
)

let game = createGame()
const alpha = game.cognitions.find((cognition) => cognition.id === 'alpha')
const beta = game.cognitions.find((cognition) => cognition.id === 'beta')
const gamma = game.cognitions.find((cognition) => cognition.id === 'gamma')
assert(alpha && beta && gamma, 'The standard three Cognitions must exist.')

const alphaBeforeBonus = alpha.bonusScore
const alphaPrepared = {
  ...alpha,
  publicNeeds: [slot(need('FN9')), slot(need('FN3'))], // Peace and Safety; neither qualifies ST27.
  privateNeed: slot(need('FN17')), // Comfort; does not privately qualify ST27.
  hand: [special, understandingStrategy, strategy('ST35'), strategy('ST43')],
  selected: encodeCommit({ strategyId: understandingStrategy.id, specialId: special.id, target: null }),
}

assert(
  !alphaPrepared.publicNeeds.some((publicNeed) => publicNeed.card.need === 'Understanding'),
  'The test must prove SA5 creates the qualifying path rather than relying on an existing Public Need.',
)

game = {
  ...game,
  cognitions: [
    alphaPrepared,
    { ...beta, hand: [], selected: null },
    { ...gamma, hand: [], selected: null },
  ],
  strategyDeck: strategies.filter((card) => !alphaPrepared.hand.some((held) => held.id === card.id)),
  bonusNeeds: [],
  phase: 'planning',
  resolution: [],
  roundLedger: null,
}

const resolved = resolveRound(game)
const ledger = resolved.roundLedger
assert(ledger, 'Resolving the round must create a ledger.')

const specialUse = ledger.specialActions.find((use) => use.card.id === 'SA5' && use.cognitionId === 'alpha')
assert(specialUse, 'The ledger must record Effective Communication before Strategy resolution.')
assert.equal(specialUse.target, 'Understanding')

const alphaResolution = resolved.resolution.find((line) => line.cognitionId === 'alpha')
assert(alphaResolution, 'The player must receive a Story resolution line.')
assert.equal(alphaResolution.specialAction?.id, 'SA5')
assert.equal(alphaResolution.strategy.id, 'ST27')
assert.equal(alphaResolution.legal, true, 'The paired Understanding Strategy must become legal through the active Bonus Need.')

const understandingAward = ledger.bonusAwards.find((award) => award.need === 'Understanding')
assert(understandingAward, 'The active Understanding Bonus Need must be available during the same resolution.')
assert.deepEqual(understandingAward.cognitionIds, ['alpha'])
assert.equal(understandingAward.pointsEach, 1)

const alphaResolved = resolved.cognitions.find((cognition) => cognition.id === 'alpha')
assert(alphaResolved)
assert.equal(alphaResolved.bonusScore, alphaBeforeBonus + 1, 'The tended Bonus gift must become the player’s individual point.')
assert.equal(
  resolved.bonusNeeds.some((bonus) => bonus.need === 'Understanding' && bonus.gifts > 0),
  false,
  'A fully tended one-gift Bonus Need must not remain active after resolution.',
)

const continued = continueRound(resolved)
const alphaContinued = continued.cognitions.find((cognition) => cognition.id === 'alpha')
assert(alphaContinued)
assert.equal(alphaContinued.hand.length, 4, 'The hand must refill to four total cards.')
assert.equal(alphaContinued.hand.some((card) => card.id === 'SA5'), false, 'The used Special Action must leave the hand.')
assert.equal(alphaContinued.hand.some((card) => card.id === 'ST27'), false, 'The paired ordinary Strategy must also leave the hand.')

console.log('SA5 engine check passed: introduce Understanding, qualify paired Strategy, award Bonus point, and refill to four.')
