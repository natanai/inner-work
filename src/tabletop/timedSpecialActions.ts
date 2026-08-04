import { needs, type NeedCard, type StrategyCard } from '../data/cards'
import { encodeCommit, parseCommit } from './commitSelection'
import {
  continueRound as continueRoundEngine,
  createGame as createGameEngine,
  nextSituation as nextSituationEngine,
  type BonusNeed,
  type Cognition,
  type CognitionId,
  type GameState,
  type Resolution,
  type SpecialActionUse,
} from './model'
import { resolveRound as resolveRulebookRound } from './rulebookResolution'
import {
  isSpecialAction,
  specialActionById,
  specialActionSummary,
  specialActionTiming,
  type SpecialActionId,
} from './specialActions'

type TimedGameState = GameState & {
  discussionActions?: SpecialActionUse[]
}

export function discussionActions(game: GameState): SpecialActionUse[] {
  return (game as TimedGameState).discussionActions ?? []
}

export function discussionActionActive(game: GameState, id: SpecialActionId): boolean {
  return discussionActions(game).some((use) => use.card.id === id)
}

export function cognitionUsedSpecialAction(game: GameState, cognitionId: CognitionId): boolean {
  if (discussionActions(game).some((use) => use.cognitionId === cognitionId)) return true
  const cognition = game.cognitions.find((item) => item.id === cognitionId)
  return Boolean(parseCommit(cognition?.selected).specialId)
}

export function eventEffectsActive(game: GameState): boolean {
  return game.situation.event || discussionActionActive(game, 'SA6')
}

export function groupPrivatePlayActive(game: GameState): boolean {
  return discussionActionActive(game, 'SA3')
}

export function ordinaryEffects(game: GameState, card: StrategyCard, boostedNeed: string | null = null) {
  if (isSpecialAction(card)) return []
  const source = eventEffectsActive(game) ? [...card.effects, ...card.eventEffects] : card.effects
  const effects = source.map((effect) => ({ ...effect }))
  if (boostedNeed) {
    const match = effects.find((effect) => effect.need === boostedNeed && effect.amount > 0)
    if (match) match.amount += 3
  }
  return effects
}

export function positiveStrength(game: GameState, card: StrategyCard, need: string, boostedNeed: string | null = null): number {
  return ordinaryEffects(game, card, boostedNeed)
    .filter((effect) => effect.need === need && effect.amount > 0)
    .reduce((total, effect) => total + effect.amount, 0)
}

function activeBonuses(game: GameState): BonusNeed[] {
  return game.bonusNeeds.filter((bonus) => bonus.gifts > 0 && bonus.availableRound <= game.round)
}

export function canPlayVisible(game: GameState, cognition: Cognition, card: StrategyCard): boolean {
  if (isSpecialAction(card)) return false
  const effects = ordinaryEffects(game, card)
  return effects.some((effect) => effect.amount > 0 && (
    cognition.publicNeeds.some((slot) => slot.gifts > 0 && slot.card.need === effect.need)
    || activeBonuses(game).some((bonus) => bonus.need === effect.need)
  ))
}

export function privateAssignmentMatches(game: GameState, cognition: Cognition, card: StrategyCard, boostedNeed: string | null = null): boolean {
  return cognition.privateNeed.gifts > 0 && positiveStrength(game, card, cognition.privateNeed.card.need, boostedNeed) > 0
}

function activeCardIds(game: GameState): Set<string> {
  return new Set(game.cognitions.flatMap((cognition) => [
    cognition.privateNeed.card.id,
    ...cognition.publicNeeds.map((slot) => slot.card.id),
  ]))
}

function drawNeedAvoiding(deckInput: NeedCard[], excluded: Set<string>): [NeedCard, NeedCard[]] {
  let deck = deckInput.filter((card) => !excluded.has(card.id))
  if (deck.length === 0) deck = needs.filter((card) => !excluded.has(card.id))
  const [card, ...rest] = deck
  if (!card) throw new Error('The Need deck could not supply another unique card.')
  return [card, rest]
}

function setupForSituation(card: NeedCard, game: GameState) {
  const situation = Math.max(0, game.situation.effects.find((effect) => effect.need === card.need)?.amount ?? 0)
  const multiplied = card.feeling === game.situation.feelingMultiplier
  const subtotal = 1 + situation
  return { base: 1, situation, multiplied, total: multiplied ? subtotal * 2 : subtotal }
}

function removeCardFromActor(game: GameState, actorId: CognitionId, cardId: string): Cognition[] {
  return game.cognitions.map((cognition) => cognition.id === actorId
    ? {
        ...cognition,
        selected: null,
        hand: cognition.hand.filter((card) => card.id !== cardId),
      }
    : cognition)
}

export function applyDiscussionSpecialAction(
  game: GameState,
  actorId: CognitionId,
  specialId: SpecialActionId,
  target: string | null = null,
): GameState {
  if (game.phase !== 'planning') return game
  const actor = game.cognitions.find((cognition) => cognition.id === actorId)
  const special = specialActionById(specialId)
  if (!actor || !special || specialActionTiming(special) !== 'Discussion Phase') return game
  if (!actor.hand.some((card) => card.id === special.id)) return game
  if (cognitionUsedSpecialAction(game, actorId)) return game

  let cognitions = removeCardFromActor(game, actorId, special.id)
  let needDeck = [...game.needDeck]
  let bonusNeeds = game.bonusNeeds.map((bonus) => ({ ...bonus }))
  let summary = specialActionSummary(special)
  let targetLabel: string | undefined

  if (special.id === 'SA1') {
    const [targetId, cardId] = (target ?? '').split(':') as [CognitionId, string]
    const targetCognition = cognitions.find((cognition) => cognition.id === targetId)
    const index = targetCognition?.publicNeeds.findIndex((slot) => slot.card.id === cardId && slot.gifts > 0) ?? -1
    if (!targetCognition || index < 0) return game
    const [replacement, rest] = drawNeedAvoiding(needDeck, activeCardIds({ ...game, cognitions }))
    needDeck = rest
    const previous = targetCognition.publicNeeds[index]
    const setup = setupForSituation(replacement, game)
    cognitions = cognitions.map((cognition) => cognition.id === targetCognition.id
      ? {
          ...cognition,
          publicNeeds: cognition.publicNeeds.map((slot, slotIndex) => slotIndex === index
            ? { card: replacement, gifts: setup.total, setup }
            : slot),
        }
      : cognition)
    targetLabel = `${targetCognition.name}: ${previous.card.need} → ${replacement.need}`
    summary = `${actor.name} replaced ${targetCognition.name}’s Public Need for ${previous.card.need} with ${replacement.feeling}: ${replacement.need} during Discussion.`
  }

  if (special.id === 'SA4') {
    const drawn: NeedCard[] = []
    const excluded = activeCardIds(game)
    for (let index = 0; index < 2; index += 1) {
      const [card, rest] = drawNeedAvoiding(needDeck, new Set([...excluded, ...drawn.map((item) => item.id)]))
      needDeck = rest
      drawn.push(card)
      bonusNeeds.push({
        id: `${game.situationNumber}-${game.round}-${actor.id}-${special.id}-${index}`,
        need: card.need,
        gifts: 1,
        initialGifts: 1,
        sourceStrategyId: special.id,
        sourceStrategyTitle: special.title,
        sourceCognitionId: actor.id,
        sourceCognitionName: actor.name,
        availableRound: game.round,
      })
    }
    targetLabel = drawn.map((card) => card.need).join(' and ')
    summary = `${actor.name} immediately introduced active Bonus Needs for ${targetLabel} during Discussion.`
  }

  if (special.id === 'SA5') {
    bonusNeeds.push({
      id: `${game.situationNumber}-${game.round}-${actor.id}-${special.id}`,
      need: 'Understanding',
      gifts: 1,
      initialGifts: 1,
      sourceStrategyId: special.id,
      sourceStrategyTitle: special.title,
      sourceCognitionId: actor.id,
      sourceCognitionName: actor.name,
      availableRound: game.round,
    })
    targetLabel = 'Understanding'
    summary = `${actor.name} immediately introduced an active Bonus Need for Understanding during Discussion.`
  }

  if (special.id === 'SA3') {
    summary = `${actor.name} opened Group Therapy during Discussion. Every Cognition may now assign one ordinary Strategy specifically to its own Private Need this round.`
  }

  if (special.id === 'SA6') {
    summary = `${actor.name} activated every ordinary Strategy’s Event effects for the remainder of this round during Discussion.`
  }

  const use: SpecialActionUse = {
    cognitionId: actor.id,
    cognitionName: actor.name,
    card: special,
    summary,
    target: targetLabel,
  }

  return {
    ...game,
    cognitions,
    needDeck,
    bonusNeeds,
    discussionActions: [...discussionActions(game), use],
  } as TimedGameState
}

function strongestPositiveNeed(game: GameState, card: StrategyCard): string | null {
  return ordinaryEffects(game, card)
    .filter((effect) => effect.amount > 0)
    .sort((left, right) => right.amount - left.amount)[0]?.need ?? null
}

function chooseNpcCommit(game: GameState, cognition: Cognition): string | null {
  const ordinary = cognition.hand.filter((card) => !isSpecialAction(card))
  const visible = ordinary.filter((card) => canPlayVisible(game, cognition, card))
  const privateMatch = ordinary.find((card) => privateAssignmentMatches(game, cognition, card)) ?? null
  const sa2 = cognition.hand.find((card) => card.id === 'SA2')
  const sa7 = cognition.hand.find((card) => card.id === 'SA7')

  if (sa2 && privateMatch) {
    return encodeCommit({ strategyId: privateMatch.id, specialId: 'SA2', target: null, playForPrivate: true })
  }
  if (groupPrivatePlayActive(game) && visible.length === 0 && privateMatch) {
    return encodeCommit({ strategyId: privateMatch.id, specialId: null, target: null, playForPrivate: true })
  }

  const chosen = visible[0] ?? ordinary[0] ?? null
  if (!chosen) return null
  if (visible.length > 0 && sa7) {
    return encodeCommit({ strategyId: chosen.id, specialId: 'SA7', target: strongestPositiveNeed(game, chosen), playForPrivate: false })
  }
  return chosen.id
}

function chooseNpcDiscussionAction(game: GameState, cognition: Cognition): { id: SpecialActionId; target: string | null } | null {
  if (cognitionUsedSpecialAction(game, cognition.id)) return null
  const held = new Set(cognition.hand.filter(isSpecialAction).map((card) => card.id))
  const noVisible = !cognition.hand.some((card) => !isSpecialAction(card) && canPlayVisible(game, cognition, card))

  if (held.has('SA3')) {
    const opensRoute = game.cognitions.some((actor) => actor.hand.some((card) => !isSpecialAction(card) && privateAssignmentMatches(game, actor, card)))
    if (opensRoute) return { id: 'SA3', target: null }
  }
  if (held.has('SA5')) {
    const understandingInPlay = game.cognitions.some((actor) => actor.hand.some((card) => !isSpecialAction(card) && positiveStrength(game, card, 'Understanding') > 0))
    if (understandingInPlay) return { id: 'SA5', target: null }
  }
  if (held.has('SA4') && noVisible) return { id: 'SA4', target: null }
  if (held.has('SA6') && !game.situation.event && cognition.hand.some((card) => !isSpecialAction(card) && card.eventEffects.length > 0)) return { id: 'SA6', target: null }
  if (held.has('SA1') && noVisible) {
    const target = cognition.publicNeeds.find((slot) => slot.gifts > 0)
    if (target) return { id: 'SA1', target: `${cognition.id}:${target.card.id}` }
  }
  return null
}

export function prepareNpcDiscussionActions(game: GameState): GameState {
  if (game.phase !== 'planning') return game
  let next = game
  for (const cognition of game.cognitions.filter((item) => !item.human)) {
    const choice = chooseNpcDiscussionAction(next, next.cognitions.find((item) => item.id === cognition.id) ?? cognition)
    if (choice) next = applyDiscussionSpecialAction(next, cognition.id, choice.id, choice.target)
  }
  return next
}

function failedPrivateResolution(game: GameState, cognition: Cognition, strategy: StrategyCard, specialId: string | null): Resolution {
  const special = specialActionById(specialId)
  const specialSummary = specialId === 'SA2'
    ? `${cognition.name} assigned “${strategy.title}” specifically to its hidden Private Need through Deep Introspection, but the Strategy did not tend that Need.`
    : `${cognition.name} assigned “${strategy.title}” specifically to its hidden Private Need through Group Therapy, but the Strategy did not tend that Need.`
  return {
    cognitionId: cognition.id,
    cognitionName: cognition.name,
    strategy,
    specialAction: special ?? undefined,
    specialSummary,
    legal: false,
    shared: 0,
    private: 0,
    publicMatches: [],
    privateMatches: [],
    bonusMatches: [],
    bonusCreated: [],
    story: `${specialSummary} The Special Action${special ? ' and paired Strategy were' : ' permission was'} spent, the Strategy was discarded, and none of its effects occurred. The unmet Private Need remains in play.`,
  }
}

export function resolveTimedRound(gameInput: GameState): GameState {
  const game = prepareNpcDiscussionActions(gameInput)
  const originalSelections = new Map(game.cognitions.map((cognition) => [cognition.id, cognition.selected]))
  const originalHuman = new Map(game.cognitions.map((cognition) => [cognition.id, cognition.human]))
  const failed: Resolution[] = []

  const withNpcChoices = game.cognitions.map((cognition) => cognition.human || cognition.selected
    ? cognition
    : { ...cognition, selected: chooseNpcCommit(game, cognition) })

  const preparedCognitions = withNpcChoices.map((cognition) => {
    const commit = parseCommit(cognition.selected)
    const strategy = cognition.hand.find((card) => card.id === commit.strategyId && !isSpecialAction(card)) ?? null
    const privateMode = commit.specialId === 'SA2' || commit.playForPrivate
    if (!privateMode || !strategy) return { ...cognition, human: true }

    const allowedByGroup = commit.specialId === 'SA2' || groupPrivatePlayActive(game)
    const boostedNeed = commit.specialId === 'SA7' ? commit.target : null
    if (!allowedByGroup || !privateAssignmentMatches(game, cognition, strategy, boostedNeed)) {
      failed.push(failedPrivateResolution(game, cognition, strategy, commit.specialId))
      return { ...cognition, human: true, selected: null }
    }

    if (commit.specialId === 'SA2') return { ...cognition, human: true }
    return {
      ...cognition,
      human: true,
      selected: encodeCommit({ strategyId: strategy.id, specialId: 'SA2', target: null, playForPrivate: true }),
    }
  })

  const eventOverride = discussionActionActive(game, 'SA6')
  const engineInput: GameState = {
    ...game,
    situation: eventOverride ? { ...game.situation, event: true } : game.situation,
    cognitions: preparedCognitions,
  }
  let resolved = resolveRulebookRound(engineInput)

  const restoredCognitions = resolved.cognitions.map((cognition) => ({
    ...cognition,
    human: originalHuman.get(cognition.id) ?? cognition.human,
    selected: originalSelections.get(cognition.id) ?? withNpcChoices.find((item) => item.id === cognition.id)?.selected ?? cognition.selected,
  }))

  const fakeGroupUses = new Set(withNpcChoices
    .filter((cognition) => parseCommit(cognition.selected).playForPrivate && parseCommit(cognition.selected).specialId !== 'SA2')
    .map((cognition) => cognition.id))
  const engineUses = (resolved.roundLedger?.specialActions ?? []).filter((use) => !(use.card.id === 'SA2' && fakeGroupUses.has(use.cognitionId)))
  const existing = resolved.resolution.filter((line) => !failed.some((failure) => failure.cognitionId === line.cognitionId))
  const combined = [...existing, ...failed]
  const ordered = [
    ...combined.filter((line) => line.cognitionId !== 'alpha'),
    ...combined.filter((line) => line.cognitionId === 'alpha'),
  ]

  resolved = {
    ...resolved,
    situation: game.situation,
    cognitions: restoredCognitions,
    resolution: ordered,
    roundLedger: resolved.roundLedger
      ? { ...resolved.roundLedger, specialActions: [...discussionActions(game), ...engineUses] }
      : resolved.roundLedger,
    discussionActions: discussionActions(game),
  } as TimedGameState
  return resolved
}

function clearDiscussionState(game: GameState): GameState {
  return { ...game, discussionActions: [] } as TimedGameState
}

export function createTimedGame(): GameState {
  return clearDiscussionState(createGameEngine())
}

export function continueTimedRound(game: GameState): GameState {
  return clearDiscussionState(continueRoundEngine(game))
}

export function nextTimedSituation(game: GameState): GameState {
  return clearDiscussionState(nextSituationEngine(game))
}
