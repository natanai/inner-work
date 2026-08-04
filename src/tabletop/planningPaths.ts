import type { StrategyCard } from '../data/cards'
import { encodeCommit } from './commitSelection'
import { generateDirectedTradeOptions } from './directedTrading'
import { canPlayCommitted, type Cognition, type GameState } from './model'
import { isSpecialAction, type SpecialActionCard } from './specialActions'

export type PlanningPathKind = 'strategy' | 'trade' | 'special' | 'magnifier' | 'discard'
export type PlanningPathAvailability = 'known' | 'uncertain'
export type PlanningPrivacy = 'player' | 'omniscient'

export type PlanningPath = {
  id: string
  kind: PlanningPathKind
  label: string
  availability: PlanningPathAvailability
  reason: string
  configurationCount: number
}

export type PlanningPathOptions = {
  privacy?: PlanningPrivacy
}

function playerFor(game: GameState): Cognition {
  return game.cognitions.find((cognition) => cognition.human) ?? game.cognitions[0]
}

function withPlayerCommit(game: GameState, player: Cognition, selected: string | null): { game: GameState; player: Cognition } {
  const cognitions = game.cognitions.map((cognition) => cognition.id === player.id ? { ...cognition, selected } : cognition)
  return { game: { ...game, cognitions }, player: cognitions.find((cognition) => cognition.id === player.id)! }
}

function ordinaryPlayableAlone(game: GameState, player: Cognition, card: StrategyCard): boolean {
  const prepared = withPlayerCommit(game, player, card.id)
  return canPlayCommitted(prepared.game, prepared.player, card)
}

function positiveNeeds(card: StrategyCard, eventActive: boolean): string[] {
  if (isSpecialAction(card)) return []
  const source = eventActive ? [...card.effects, ...card.eventEffects] : card.effects
  return [...new Set(source.filter((effect) => effect.amount > 0).map((effect) => effect.need))]
}

function positiveStrength(card: StrategyCard, need: string, eventActive: boolean): number {
  if (isSpecialAction(card)) return 0
  const source = eventActive ? [...card.effects, ...card.eventEffects] : card.effects
  return source.filter((effect) => effect.need === need && effect.amount > 0).reduce((total, effect) => total + effect.amount, 0)
}

function specialPath(
  game: GameState,
  player: Cognition,
  card: SpecialActionCard,
  ordinary: StrategyCard[],
  privacy: PlanningPrivacy,
): PlanningPath | null {
  const unresolvedPublic = game.cognitions.flatMap((cognition) => cognition.publicNeeds).filter((slot) => slot.gifts > 0)
  const eventActive = game.situation.event

  if (card.id === 'SA1') {
    if (unresolvedPublic.length === 0) return null
    return {
      id: 'special:SA1', kind: 'special', label: card.title, availability: 'known',
      reason: `Choose one of ${unresolvedPublic.length} unresolved Public Needs to replace.`,
      configurationCount: unresolvedPublic.length,
    }
  }

  if (card.id === 'SA2') {
    if (ordinary.length === 0) return null
    if (privacy === 'player') {
      return {
        id: 'special:SA2', kind: 'special', label: card.title, availability: 'uncertain',
        reason: 'A paired Strategy may qualify through your face-down Private Need; the app will not confirm a match before resolution.',
        configurationCount: ordinary.length,
      }
    }
    const matches = ordinary.filter((strategy) => positiveStrength(strategy, player.privateNeed.card.need, eventActive) > 0)
    if (matches.length === 0) return null
    return {
      id: 'special:SA2', kind: 'special', label: card.title, availability: 'known',
      reason: `${matches.length} paired ${matches.length === 1 ? 'Strategy qualifies' : 'Strategies qualify'} through the Private Need.`,
      configurationCount: matches.length,
    }
  }

  if (card.id === 'SA3') {
    if (privacy === 'player') {
      return {
        id: 'special:SA3', kind: 'special', label: card.title, availability: 'uncertain',
        reason: 'This may open a Private-Need route for one or more Cognitions without revealing any face-down Need.',
        configurationCount: 1,
      }
    }
    const matchingCognitions = game.cognitions.filter((cognition) => cognition.hand.some((strategy) =>
      !isSpecialAction(strategy) && positiveStrength(strategy, cognition.privateNeed.card.need, eventActive) > 0,
    )).length
    if (matchingCognitions === 0) return null
    return {
      id: 'special:SA3', kind: 'special', label: card.title, availability: 'known',
      reason: `${matchingCognitions} ${matchingCognitions === 1 ? 'Cognition has' : 'Cognitions have'} a qualifying Private-Need route.`,
      configurationCount: matchingCognitions,
    }
  }

  if (card.id === 'SA4') {
    return {
      id: 'special:SA4', kind: 'special', label: card.title, availability: 'known',
      reason: 'Draw two random active Bonus Needs before ordinary Strategies resolve.',
      configurationCount: 1,
    }
  }

  if (card.id === 'SA5') {
    const pairings = ordinary.filter((strategy) => positiveStrength(strategy, 'Understanding', eventActive) > 0).length
    return {
      id: 'special:SA5', kind: 'special', label: card.title, availability: 'known',
      reason: pairings > 0
        ? `Create Understanding immediately; ${pairings} card${pairings === 1 ? '' : 's'} in hand can tend it.`
        : 'Create an active Bonus Need for Understanding before resolution.',
      configurationCount: Math.max(1, pairings),
    }
  }

  if (card.id === 'SA6') {
    const pairings = ordinary.filter((strategy) => strategy.eventEffects.length > 0).length
    return {
      id: 'special:SA6', kind: 'special', label: card.title, availability: 'known',
      reason: pairings > 0
        ? `Activate Event effects; ${pairings} card${pairings === 1 ? '' : 's'} in your hand visibly change.`
        : 'Activate Event effects on every ordinary Strategy played this round, including hidden NPC plays.',
      configurationCount: Math.max(1, pairings),
    }
  }

  const boostTargets = ordinary.reduce((total, strategy) => total + positiveNeeds(strategy, eventActive).length, 0)
  if (boostTargets === 0) return null
  return {
    id: 'special:SA7', kind: 'special', label: card.title, availability: 'known',
    reason: `Choose among ${boostTargets} positive effect target${boostTargets === 1 ? '' : 's'} across the ordinary Strategies in hand.`,
    configurationCount: boostTargets,
  }
}

export function enumeratePlanningPaths(game: GameState, options: PlanningPathOptions = {}): PlanningPath[] {
  if (game.phase !== 'planning') return []
  const privacy = options.privacy ?? 'player'
  const player = playerFor(game)
  const ordinary = player.hand.filter((card) => !isSpecialAction(card))
  const specials = player.hand.filter(isSpecialAction)
  const paths: PlanningPath[] = []

  const playable = ordinary.filter((card) => ordinaryPlayableAlone(game, player, card))
  playable.forEach((card) => paths.push({
    id: `strategy:${card.id}`,
    kind: 'strategy',
    label: card.title,
    availability: 'known',
    reason: 'This card visibly tends one of your unresolved Public Needs or an active Bonus Need.',
    configurationCount: 1,
  }))

  const groupedTrades = new Map<string, ReturnType<typeof generateDirectedTradeOptions>>()
  for (const option of generateDirectedTradeOptions(game)) {
    const key = `${option.requestedKind}:${option.requestedNeed}:${option.npcId}:${option.npcGives.id}`
    groupedTrades.set(key, [...(groupedTrades.get(key) ?? []), option])
  }
  for (const [key, optionsForOffer] of groupedTrades) {
    const first = optionsForOffer[0]
    paths.push({
      id: `trade:${key}`,
      kind: 'trade',
      label: `Trade for ${first.requestedNeed}`,
      availability: 'known',
      reason: `${first.npcName} can offer “${first.npcGives.title}”; ${optionsForOffer.length} payment card${optionsForOffer.length === 1 ? '' : 's'} would be accepted.`,
      configurationCount: optionsForOffer.length,
    })
  }

  specials.forEach((card) => {
    const path = specialPath(game, player, card, ordinary, privacy)
    if (path) paths.push(path)
  })

  if (!player.magnifierUsed) {
    const refreshConfigurations = Math.max(1, (2 ** player.hand.length) - 1)
    paths.push({
      id: 'magnifier:refresh', kind: 'magnifier', label: 'Replace Strategy cards', availability: 'known',
      reason: `Replace any non-empty set from your hand (${refreshConfigurations} possible card sets).`,
      configurationCount: refreshConfigurations,
    })

    const ownTargets = player.publicNeeds.filter((slot) => slot.gifts > 0).length
    if (ownTargets > 0) paths.push({
      id: 'magnifier:own-need', kind: 'magnifier', label: 'Replace one of your Public Needs', availability: 'known',
      reason: `${ownTargets} unresolved target${ownTargets === 1 ? '' : 's'} available.`,
      configurationCount: ownTargets,
    })

    const otherTargets = game.cognitions.filter((cognition) => !cognition.human)
      .flatMap((cognition) => cognition.publicNeeds).filter((slot) => slot.gifts > 0).length
    if (otherTargets > 0) paths.push({
      id: 'magnifier:other-need', kind: 'magnifier', label: 'Request another Cognition’s Need change', availability: 'uncertain',
      reason: `${otherTargets} unresolved target${otherTargets === 1 ? '' : 's'} can be requested; permission is not guaranteed.`,
      configurationCount: otherTargets,
    })

    paths.push({
      id: 'magnifier:private', kind: 'magnifier', label: 'Review your Private Need', availability: 'known',
      reason: 'Look once, then return the card face down.',
      configurationCount: 1,
    })
  }

  if (playable.length === 0) paths.push({
    id: 'discard:required', kind: 'discard', label: 'Discard one Strategy', availability: 'known',
    reason: 'No ordinary Strategy is visibly legal without another action changing the state.',
    configurationCount: Math.max(1, ordinary.length),
  })

  return paths
}

export function summarizePlanningPaths(paths: PlanningPath[]) {
  const count = (kind: PlanningPathKind) => paths.filter((path) => path.kind === kind).length
  return {
    total: paths.length,
    known: paths.filter((path) => path.availability === 'known').length,
    uncertain: paths.filter((path) => path.availability === 'uncertain').length,
    strategy: count('strategy'),
    trade: count('trade'),
    special: count('special'),
    magnifier: count('magnifier'),
    discard: count('discard'),
  }
}
