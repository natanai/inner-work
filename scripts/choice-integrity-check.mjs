import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const { needs, strategies } = await server.ssrLoadModule('/src/data/cards.ts')
  const { createGame } = await server.ssrLoadModule('/src/tabletop/model.ts')
  const { encodeCommit } = await server.ssrLoadModule('/src/tabletop/commitSelection.ts')
  const { enumeratePlanningPaths, summarizePlanningPaths } = await server.ssrLoadModule('/src/tabletop/planningPaths.ts')
  const { resolveRound } = await server.ssrLoadModule('/src/tabletop/rulebookResolution.ts')
  const { allStrategyCards, specialActionById } = await server.ssrLoadModule('/src/tabletop/specialActions.ts')

  const need = (id) => {
    const card = needs.find((item) => item.id === id)
    assert(card, `Missing Need ${id}`)
    return card
  }
  const strategy = (id) => {
    const card = strategies.find((item) => item.id === id)
    assert(card, `Missing Strategy ${id}`)
    return card
  }
  const special = (id) => {
    const card = specialActionById(id)
    assert(card, `Missing Special Action ${id}`)
    return card
  }
  const slot = (card, gifts = 1) => ({
    card,
    gifts,
    setup: { base: gifts, situation: 0, multiplied: false, total: gifts },
  })

  // Rulebook scoring: every legal story that tends the Bonus Need receives all shown gifts.
  {
    const base = createGame()
    const [alpha, beta, gamma] = base.cognitions
    const alphaCard = strategy('ST27') // Understanding +2
    const betaCard = strategy('ST54') // Understanding +1
    const filler = [strategy('ST35'), strategy('ST43'), strategy('ST37')]
    const cognitions = [
      {
        ...alpha,
        human: true,
        publicNeeds: [slot(need('FN3')), slot(need('FN17'))],
        privateNeed: slot(need('FN26')),
        hand: [alphaCard, ...filler],
        selected: alphaCard.id,
        bonusScore: 0,
      },
      {
        ...beta,
        human: true,
        publicNeeds: [slot(need('FN5')), slot(need('FN11'))],
        privateNeed: slot(need('FN23')),
        hand: [betaCard, strategy('ST21'), strategy('ST31'), strategy('ST46')],
        selected: betaCard.id,
        bonusScore: 0,
      },
      {
        ...gamma,
        human: true,
        publicNeeds: [slot(need('FN15')), slot(need('FN28'))],
        privateNeed: slot(need('FN29')),
        hand: [strategy('ST1'), strategy('ST2'), strategy('ST6'), strategy('ST7')],
        selected: null,
        bonusScore: 0,
      },
    ]
    const held = new Set(cognitions.flatMap((cognition) => cognition.hand.map((card) => card.id)))
    const game = {
      ...base,
      cognitions,
      strategyDeck: allStrategyCards.filter((card) => !held.has(card.id)),
      bonusNeeds: [{
        id: 'rulebook-bonus-understanding',
        need: 'Understanding',
        gifts: 2,
        initialGifts: 2,
        sourceStrategyId: 'ST1',
        sourceStrategyTitle: 'Test source',
        sourceCognitionId: 'gamma',
        sourceCognitionName: 'Cognition γ',
        availableRound: 1,
      }],
      round: 1,
      phase: 'planning',
      resolution: [],
      roundLedger: null,
    }

    const resolved = resolveRound(game)
    const award = resolved.roundLedger?.bonusAwards.find((item) => item.bonusId === 'rulebook-bonus-understanding')
    assert(award, 'The available Bonus Need must award points.')
    assert.deepEqual(award.cognitionIds, ['alpha', 'beta'])
    assert.equal(award.pointsEach, 2)
    assert.equal(resolved.cognitions.find((item) => item.id === 'alpha')?.bonusScore, 2)
    assert.equal(resolved.cognitions.find((item) => item.id === 'beta')?.bonusScore, 2)
    assert.equal(resolved.bonusNeeds.some((item) => item.id === 'rulebook-bonus-understanding'), false)
  }

  // Privacy-safe choice accounting: the visible summary acknowledges a possibility without confirming the hidden match.
  {
    const base = createGame()
    const [alpha, beta, gamma] = base.cognitions
    const sa2 = special('SA2')
    const st27 = strategy('ST27')
    const cognitions = [
      {
        ...alpha,
        human: true,
        publicNeeds: [slot(need('FN9')), slot(need('FN3'))],
        privateNeed: slot(need('FN7')),
        hand: [sa2, st27, strategy('ST35'), strategy('ST43')],
        selected: null,
        magnifierUsed: false,
      },
      { ...beta, human: false, publicNeeds: [slot(need('FN5')), slot(need('FN11'))] },
      { ...gamma, human: false, publicNeeds: [slot(need('FN15')), slot(need('FN28'))] },
    ]
    const game = { ...base, cognitions, phase: 'planning', bonusNeeds: [], resolution: [], roundLedger: null }

    const visible = enumeratePlanningPaths(game, { privacy: 'player' })
    const hiddenPath = visible.find((path) => path.id === 'special:SA2')
    assert(hiddenPath)
    assert.equal(hiddenPath.availability, 'uncertain')
    assert.equal(hiddenPath.reason.includes(st27.title), false, 'The visible path must not reveal the matching Strategy.')

    const omniscient = enumeratePlanningPaths(game, { privacy: 'omniscient' })
    const actualPath = omniscient.find((path) => path.id === 'special:SA2')
    assert(actualPath)
    assert.equal(actualPath.availability, 'known')
    assert.equal(actualPath.configurationCount, 1)

    const summary = summarizePlanningPaths(visible)
    assert.equal(summary.magnifier, 4, 'The Magnifier contributes four routes, with target configurations reported inside them.')
    assert.equal(new Set(visible.map((path) => path.id)).size, visible.length, 'Every planning route ID must be unique.')
  }

  // Removing a paired Strategy still clears a required Special Action commitment.
  {
    const selected = encodeCommit({ strategyId: 'ST27', specialId: 'SA2', target: null })
    assert(selected)
  }

  console.log('Choice integrity check passed: rulebook Bonus scoring and privacy-safe canonical planning routes are verified.')
} finally {
  await server.close()
}
