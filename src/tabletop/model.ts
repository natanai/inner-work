import { needs, situations, type Effect, type NeedCard, type SituationCard, type StrategyCard } from '../data/cards'
import { encodeCommit, parseCommit } from './commitSelection'
import {
  allStrategyCards,
  isSpecialAction,
  specialActionById,
  specialActionSummary,
  type SpecialActionCard,
} from './specialActions'

export type Phase = 'planning' | 'revealed' | 'complete'
export type CognitionId = 'alpha' | 'beta' | 'gamma'
export type GiftSetup = {
  base: number
  situation: number
  multiplied: boolean
  total: number
}
export type NeedSlot = {
  card: NeedCard
  gifts: number
  setup: GiftSetup
}
export type BonusNeed = {
  id: string
  need: string
  gifts: number
  initialGifts: number
  sourceStrategyId: string
  sourceStrategyTitle: string
  sourceCognitionId: CognitionId
  sourceCognitionName: string
  availableRound: number
}
export type Cognition = {
  id: CognitionId
  name: string
  human: boolean
  style?: 'shared' | 'self'
  publicNeeds: NeedSlot[]
  privateNeed: NeedSlot
  privateVisible: boolean
  magnifierUsed: boolean
  hand: StrategyCard[]
  selected: string | null
  privateScore: number
  bonusScore: number
}
export type SpecialActionUse = {
  cognitionId: CognitionId
  cognitionName: string
  card: StrategyCard
  summary: string
  target?: string
}
export type Resolution = {
  cognitionId: CognitionId
  cognitionName: string
  strategy: StrategyCard
  specialAction?: StrategyCard
  specialSummary?: string
  legal: boolean
  shared: number
  private: number
  story: string
  publicMatches: string[]
  privateMatches: string[]
  bonusMatches: string[]
  bonusCreated: BonusNeed[]
}
export type PublicNeedChange = {
  key: string
  cognitionId: CognitionId
  cognitionName: string
  need: string
  feeling: string
  before: number
  after: number
  removed: number
  setup: GiftSetup
}
export type BonusAward = {
  bonusId: string
  need: string
  cognitionIds: CognitionId[]
  cognitionNames: string[]
  pointsEach: number
}
export type PrivateAward = {
  cognitionId: CognitionId
  cognitionName: string
  need: string
  points: number
}
export type RoundLedger = {
  publicChanges: PublicNeedChange[]
  publicRemoved: number
  sharedBefore: number
  sharedAfter: number
  privateAwards: PrivateAward[]
  bonusAwards: BonusAward[]
  bonusCreated: BonusNeed[]
  specialActions: SpecialActionUse[]
}
export type GameState = {
  cognitions: Cognition[]
  situation: SituationCard
  situationDeck: SituationCard[]
  needDeck: NeedCard[]
  strategyDeck: StrategyCard[]
  bonusNeeds: BonusNeed[]
  sharedScore: number
  situationNumber: number
  round: number
  phase: Phase
  resolution: Resolution[]
  roundLedger: RoundLedger | null
}

const templates = [
  { id: 'alpha' as const, name: 'Cognition α', human: true },
  { id: 'beta' as const, name: 'Cognition β', human: false, style: 'shared' as const },
  { id: 'gamma' as const, name: 'Cognition γ', human: false, style: 'self' as const },
]

const baseSetup = (): GiftSetup => ({ base: 1, situation: 0, multiplied: false, total: 1 })
const needKey = (cognitionId: CognitionId, cardId: string) => `${cognitionId}:${cardId}`

function shuffle<T>(source: T[]): T[] {
  const result = [...source]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

function draw<T>(deck: T[], recycle: T[]): [T, T[]] {
  const source = deck.length ? deck : shuffle(recycle)
  const [card, ...rest] = source
  if (!card) throw new Error('A deck unexpectedly ran out of cards.')
  return [card, rest]
}

function drawNeedAvoiding(deckInput: NeedCard[], excluded: Set<string>): [NeedCard, NeedCard[]] {
  let deck = deckInput.filter((card) => !excluded.has(card.id))
  if (deck.length === 0) deck = shuffle(needs.filter((card) => !excluded.has(card.id)))
  const [card, ...rest] = deck
  if (!card) throw new Error('The Need deck could not supply another unique card.')
  return [card, rest]
}

function situationSetup(card: NeedCard, situation: SituationCard): GiftSetup {
  const added = Math.max(0, situation.effects.find((effect) => effect.need === card.need)?.amount ?? 0)
  const multiplied = card.feeling === situation.feelingMultiplier
  const subtotal = 1 + added
  return {
    base: 1,
    situation: added,
    multiplied,
    total: multiplied ? subtotal * 2 : subtotal,
  }
}

function applySituation(cognitions: Cognition[], situation: SituationCard): Cognition[] {
  return cognitions.map((cognition) => ({
    ...cognition,
    magnifierUsed: false,
    privateVisible: false,
    selected: null,
    publicNeeds: cognition.publicNeeds.map((slot) => {
      const setup = situationSetup(slot.card, situation)
      return { card: slot.card, gifts: setup.total, setup }
    }),
  }))
}

function activeBonusNeeds(game: Pick<GameState, 'bonusNeeds' | 'round'>): BonusNeed[] {
  return game.bonusNeeds.filter((bonus) => bonus.gifts > 0 && bonus.availableRound <= game.round)
}

function effectsFor(
  strategy: StrategyCard,
  situation: SituationCard,
  eventOverride = false,
  boostedNeed: string | null = null,
): Effect[] {
  if (isSpecialAction(strategy)) return []
  const source = situation.event || eventOverride
    ? [...strategy.effects, ...strategy.eventEffects]
    : strategy.effects
  const result = source.map((effect) => ({ ...effect }))
  if (boostedNeed) {
    const matching = result.find((effect) => effect.need === boostedNeed && effect.amount > 0)
    if (matching) matching.amount += 3
  }
  return result
}

function positiveStrength(
  strategy: StrategyCard,
  situation: SituationCard,
  need: string,
  eventOverride = false,
  boostedNeed: string | null = null,
): number {
  return effectsFor(strategy, situation, eventOverride, boostedNeed)
    .filter((effect) => effect.need === need && effect.amount > 0)
    .reduce((total, effect) => total + effect.amount, 0)
}

export function createGame(): GameState {
  let needDeck = shuffle(needs)
  let strategyDeck = shuffle(allStrategyCards)
  const shuffledSituations = shuffle(situations)
  const [situation, ...situationDeck] = shuffledSituations

  const cognitions: Cognition[] = templates.map((template) => {
    const dealtNeeds = needDeck.slice(0, 3)
    needDeck = needDeck.slice(3)
    const hand = strategyDeck.slice(0, 4)
    strategyDeck = strategyDeck.slice(4)
    return {
      ...template,
      publicNeeds: dealtNeeds.slice(1).map((card) => ({ card, gifts: 1, setup: baseSetup() })),
      privateNeed: { card: dealtNeeds[0], gifts: 1, setup: baseSetup() },
      privateVisible: false,
      magnifierUsed: false,
      hand,
      selected: null,
      privateScore: 0,
      bonusScore: 0,
    }
  })

  return {
    cognitions: applySituation(cognitions, situation),
    situation,
    situationDeck,
    needDeck,
    strategyDeck,
    bonusNeeds: [],
    sharedScore: 0,
    situationNumber: 1,
    round: 1,
    phase: 'planning',
    resolution: [],
    roundLedger: null,
  }
}

export function canPlay(cognition: Cognition, strategy: StrategyCard, bonusNeeds: BonusNeed[] = []): boolean {
  if (isSpecialAction(strategy)) return false
  return strategy.effects.some((effect) => effect.amount > 0 && (
    cognition.publicNeeds.some((slot) => slot.gifts > 0 && slot.card.need === effect.need)
    || bonusNeeds.some((bonus) => bonus.gifts > 0 && bonus.need === effect.need)
  ))
}

function roundHasSpecial(game: GameState, specialId: string): boolean {
  return game.cognitions.some((cognition) => parseCommit(cognition.selected).specialId === specialId)
}

export function canPlayCommitted(game: GameState, cognition: Cognition, strategy: StrategyCard): boolean {
  if (isSpecialAction(strategy)) return true
  const commit = parseCommit(cognition.selected)
  const eventOverride = roundHasSpecial(game, 'SA6')
  const virtualBonuses = [...activeBonusNeeds(game)]
  if (roundHasSpecial(game, 'SA5')) {
    virtualBonuses.push({
      id: 'preview-understanding',
      need: 'Understanding',
      gifts: 1,
      initialGifts: 1,
      sourceStrategyId: 'SA5',
      sourceStrategyTitle: 'Effective Communication',
      sourceCognitionId: cognition.id,
      sourceCognitionName: cognition.name,
      availableRound: game.round,
    })
  }
  const effects = effectsFor(strategy, game.situation, eventOverride, commit.specialId === 'SA7' ? commit.target : null)
  const ordinary = effects.some((effect) => effect.amount > 0 && (
    cognition.publicNeeds.some((slot) => slot.gifts > 0 && slot.card.need === effect.need)
    || virtualBonuses.some((bonus) => bonus.gifts > 0 && bonus.need === effect.need)
  ))
  const privateAllowed = commit.specialId === 'SA2' || roundHasSpecial(game, 'SA3')
  return ordinary || (privateAllowed && cognition.privateNeed.gifts > 0 && effects.some((effect) => effect.amount > 0 && effect.need === cognition.privateNeed.card.need))
}

function npcValue(cognition: Cognition, all: Cognition[], strategy: StrategyCard, game: GameState, eventOverride = false): number {
  if (isSpecialAction(strategy)) return Number.NEGATIVE_INFINITY
  const bonuses = activeBonusNeeds(game)
  const effects = effectsFor(strategy, game.situation, eventOverride)
  const legal = effects.some((effect) => effect.amount > 0 && (
    cognition.publicNeeds.some((slot) => slot.gifts > 0 && slot.card.need === effect.need)
    || bonuses.some((bonus) => bonus.gifts > 0 && bonus.need === effect.need)
  ))
  if (!legal) return Number.NEGATIVE_INFINITY
  let shared = 0
  let ownPublic = 0
  let ownPrivate = 0
  let bonus = 0
  for (const effect of effects) {
    if (effect.amount <= 0) continue
    for (const target of all) {
      for (const slot of target.publicNeeds) {
        if (slot.gifts > 0 && slot.card.need === effect.need) {
          const value = Math.min(slot.gifts, effect.amount)
          shared += value
          if (target.id === cognition.id) ownPublic += value
        }
      }
    }
    if (cognition.privateNeed.gifts > 0 && cognition.privateNeed.card.need === effect.need) {
      ownPrivate += Math.min(cognition.privateNeed.gifts, effect.amount)
    }
    for (const target of bonuses) {
      if (target.need === effect.need) bonus += Math.min(target.gifts, effect.amount)
    }
  }
  const wobble = Math.random() * .35
  return cognition.style === 'self'
    ? ownPublic * 5 + ownPrivate * 4 + bonus * 3 + shared * 1.4 + wobble
    : shared * 5 + ownPublic * 1.5 + ownPrivate * 2 + bonus * 2.5 + wobble
}

function strongestPositiveNeed(strategy: StrategyCard, eventActive: boolean): string | null {
  const effects = eventActive ? [...strategy.effects, ...strategy.eventEffects] : strategy.effects
  return effects.filter((effect) => effect.amount > 0).sort((left, right) => right.amount - left.amount)[0]?.need ?? null
}

function chooseNpcCommit(cognition: Cognition, all: Cognition[], game: GameState): string | null {
  const ordinary = cognition.hand.filter((card) => !isSpecialAction(card))
  const specials = cognition.hand.filter(isSpecialAction)
  const ranked = ordinary
    .map((strategy) => ({ strategy, score: npcValue(cognition, all, strategy, game) }))
    .sort((a, b) => b.score - a.score)
  const legal = ranked.filter(({ score }) => Number.isFinite(score))
  const privateCard = ordinary
    .map((strategy) => ({ strategy, strength: positiveStrength(strategy, game.situation, cognition.privateNeed.card.need) }))
    .filter(({ strength }) => strength > 0)
    .sort((a, b) => b.strength - a.strength)[0]?.strategy ?? null

  const deepIntrospection = specials.find((card) => card.id === 'SA2')
  const groupTherapy = specials.find((card) => card.id === 'SA3')
  if (privateCard && (deepIntrospection || groupTherapy)) {
    return encodeCommit({ strategyId: privateCard.id, specialId: (deepIntrospection ?? groupTherapy)!.id, target: null })
  }

  const effectiveCommunication = specials.find((card) => card.id === 'SA5')
  const understandingCard = ordinary.find((strategy) => positiveStrength(strategy, game.situation, 'Understanding') > 0)
  if (effectiveCommunication && understandingCard && legal.length === 0) {
    return encodeCommit({ strategyId: understandingCard.id, specialId: effectiveCommunication.id, target: null })
  }

  const turnOfEvents = specials.find((card) => card.id === 'SA6')
  if (turnOfEvents && !game.situation.event) {
    const eventCandidate = ordinary
      .map((strategy) => ({ strategy, score: npcValue(cognition, all, strategy, game, true) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => b.score - a.score)[0]?.strategy
    if (eventCandidate && legal.length === 0) {
      return encodeCommit({ strategyId: eventCandidate.id, specialId: turnOfEvents.id, target: null })
    }
  }

  const chosen = legal[0]?.strategy ?? ordinary[Math.floor(Math.random() * Math.max(ordinary.length, 1))] ?? null
  const chosenLegal = Boolean(chosen && legal.some(({ strategy }) => strategy.id === chosen.id))
  if (!chosen) {
    const loneSpecial = specials[0]
    return loneSpecial ? encodeCommit({ strategyId: null, specialId: loneSpecial.id, target: null }) : null
  }

  const deepBreath = specials.find((card) => card.id === 'SA7')
  if (chosenLegal && deepBreath) {
    return encodeCommit({ strategyId: chosen.id, specialId: deepBreath.id, target: strongestPositiveNeed(chosen, game.situation.event) })
  }
  if (chosenLegal && turnOfEvents && !game.situation.event && chosen.eventEffects.length > 0) {
    return encodeCommit({ strategyId: chosen.id, specialId: turnOfEvents.id, target: null })
  }
  const emergency = specials.find((card) => card.id === 'SA4')
  if (chosenLegal && emergency) return encodeCommit({ strategyId: chosen.id, specialId: emergency.id, target: null })
  if (chosenLegal && effectiveCommunication) return encodeCommit({ strategyId: chosen.id, specialId: effectiveCommunication.id, target: null })

  const spontaneous = specials.find((card) => card.id === 'SA1')
  if (!chosenLegal && spontaneous) {
    const target = cognition.publicNeeds[0]
    return encodeCommit({ strategyId: chosen.id, specialId: spontaneous.id, target: target ? `${cognition.id}:${target.card.id}` : null })
  }
  if (!chosenLegal && emergency) return encodeCommit({ strategyId: chosen.id, specialId: emergency.id, target: null })
  return chosen.id
}

function unique(items: string[]): string[] {
  return [...new Set(items)]
}

function joinNatural(items: string[]): string {
  const values = unique(items)
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`
}

function actionPhrase(title: string): string {
  const cleaned = title.replace(/[.!?]+$/, '')
  return cleaned ? cleaned[0].toLowerCase() + cleaned.slice(1) : title
}

function simpleStory(actor: Cognition, strategy: StrategyCard, situation: SituationCard, legal: boolean, specialSummary?: string): string {
  const specialSentence = specialSummary ? `${actor.name} first used a Special Action: ${specialSummary}` : ''
  if (isSpecialAction(strategy)) return specialSentence || `${actor.name} used “${strategy.title}.”`
  const strategySentence = legal
    ? `${actor.name} influenced the shared person to ${actionPhrase(strategy.title)} during “${situation.title}.”`
    : `${actor.name} could not use “${strategy.title}” to tend one of its own Public Needs or an active Bonus Need, so that Strategy was discarded.`
  return [specialSentence, strategySentence].filter(Boolean).join(' ')
}

type PreparedRound = {
  cognitions: Cognition[]
  needDeck: NeedCard[]
  bonusNeeds: BonusNeed[]
  eventOverride: boolean
  groupPrivate: boolean
  privateActors: Set<CognitionId>
  boosts: Map<CognitionId, string>
  uses: SpecialActionUse[]
}

function activeCardIds(cognitions: Cognition[]): Set<string> {
  return new Set(cognitions.flatMap((cognition) => [
    cognition.privateNeed.card.id,
    ...cognition.publicNeeds.map((slot) => slot.card.id),
  ]))
}

function prepareSpecialActions(game: GameState, choicesInput: Cognition[]): PreparedRound {
  let cognitions = choicesInput.map((cognition) => ({
    ...cognition,
    publicNeeds: cognition.publicNeeds.map((slot) => ({ ...slot, setup: { ...slot.setup } })),
    privateNeed: { ...cognition.privateNeed, setup: { ...cognition.privateNeed.setup } },
  }))
  let needDeck = [...game.needDeck]
  const bonusNeeds = game.bonusNeeds.map((bonus) => ({ ...bonus }))
  const eventOverride = cognitions.some((cognition) => parseCommit(cognition.selected).specialId === 'SA6')
  const groupPrivate = cognitions.some((cognition) => parseCommit(cognition.selected).specialId === 'SA3')
  const privateActors = new Set<CognitionId>()
  const boosts = new Map<CognitionId, string>()
  const uses: SpecialActionUse[] = []

  for (const actor of cognitions) {
    const commit = parseCommit(actor.selected)
    const special = specialActionById(commit.specialId)
    if (!special) continue
    let summary = specialActionSummary(special)
    let targetLabel: string | undefined

    if (special.id === 'SA2') privateActors.add(actor.id)
    if (special.id === 'SA7' && commit.target) boosts.set(actor.id, commit.target)

    if (special.id === 'SA1') {
      const [targetId, targetCardId] = (commit.target ?? '').split(':') as [CognitionId, string]
      const target = cognitions.find((cognition) => cognition.id === targetId)
      const slotIndex = target?.publicNeeds.findIndex((slot) => slot.card.id === targetCardId) ?? -1
      if (target && slotIndex >= 0) {
        const excluded = activeCardIds(cognitions)
        const [replacement, rest] = drawNeedAvoiding(needDeck, excluded)
        needDeck = rest
        const setup = situationSetup(replacement, game.situation)
        const previous = target.publicNeeds[slotIndex]
        target.publicNeeds[slotIndex] = { card: replacement, gifts: setup.total, setup }
        targetLabel = `${target.name}: ${previous.card.need} → ${replacement.need}`
        summary = `${actor.name} replaced ${target.name}’s Public Need for ${previous.card.need} with ${replacement.feeling}: ${replacement.need}.`
      } else {
        summary = `${actor.name} played Spontaneous Help, but its selected Public Need was no longer available.`
      }
    }

    if (special.id === 'SA4') {
      const drawn: NeedCard[] = []
      const excluded = activeCardIds(cognitions)
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
      summary = `${actor.name} introduced active Bonus Needs for ${targetLabel}.`
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
      summary = `${actor.name} introduced an active Bonus Need for Understanding.`
    }

    if (special.id === 'SA6') summary = `${actor.name} activated the Event effects printed on every paired Strategy this round.`
    if (special.id === 'SA2') summary = `${actor.name} may qualify its paired Strategy through its own hidden Private Need this round.`
    if (special.id === 'SA3') summary = `${actor.name} opened a Group Therapy Session, allowing every Cognition to qualify through its own hidden Private Need this round.`
    if (special.id === 'SA7') {
      const selectedStrategy = actor.hand.find((card) => card.id === commit.strategyId && !isSpecialAction(card))
      const validTarget = selectedStrategy && commit.target && effectsFor(selectedStrategy, game.situation, eventOverride).some((effect) => effect.need === commit.target && effect.amount > 0)
      if (validTarget) {
        targetLabel = commit.target ?? undefined
        summary = `${actor.name} added +3 to ${selectedStrategy.title}’s ${commit.target} effect.`
      } else {
        boosts.delete(actor.id)
        summary = `${actor.name} played Deep Breath, but no valid positive Strategy effect was selected to boost.`
      }
    }

    uses.push({ cognitionId: actor.id, cognitionName: actor.name, card: special, summary, target: targetLabel })
  }

  return { cognitions, needDeck, bonusNeeds, eventOverride, groupPrivate, privateActors, boosts, uses }
}

function preparedCanPlay(
  actor: Cognition,
  strategy: StrategyCard,
  bonuses: BonusNeed[],
  situation: SituationCard,
  eventOverride: boolean,
  privateAllowed: boolean,
  boostedNeed: string | null,
): boolean {
  const effects = effectsFor(strategy, situation, eventOverride, boostedNeed)
  return effects.some((effect) => effect.amount > 0 && (
    actor.publicNeeds.some((slot) => slot.gifts > 0 && slot.card.need === effect.need)
    || bonuses.some((bonus) => bonus.gifts > 0 && bonus.need === effect.need)
    || (privateAllowed && actor.privateNeed.gifts > 0 && actor.privateNeed.card.need === effect.need)
  ))
}

export function resolveRound(game: GameState): GameState {
  const initialChoices = game.cognitions.map((cognition) => cognition.human
    ? cognition
    : { ...cognition, selected: chooseNpcCommit(cognition, game.cognitions, game) })
  const prepared = prepareSpecialActions(game, initialChoices)
  const choices = prepared.cognitions
  const bonusesBefore = activeBonusNeeds({ bonusNeeds: prepared.bonusNeeds, round: game.round })
  const selected = choices.map((actor) => {
    const commit = parseCommit(actor.selected)
    const strategy = actor.hand.find((card) => card.id === commit.strategyId && !isSpecialAction(card)) ?? null
    const special = actor.hand.find((card) => card.id === commit.specialId && isSpecialAction(card)) ?? null
    return { actor, commit, strategy, special }
  })
  const legalSelections = selected.flatMap(({ actor, commit, strategy }) => {
    if (!strategy) return []
    const privateAllowed = prepared.groupPrivate || prepared.privateActors.has(actor.id)
    const boostedNeed = commit.specialId === 'SA7' ? prepared.boosts.get(actor.id) ?? null : null
    return preparedCanPlay(actor, strategy, bonusesBefore, game.situation, prepared.eventOverride, privateAllowed, boostedNeed)
      ? [{ actor, strategy, boostedNeed }]
      : []
  })

  const publicBefore = choices.flatMap((cognition) => cognition.publicNeeds.map((slot) => ({ cognition, slot })))
  const publicStrength = new Map<string, number>()
  for (const { actor, strategy, boostedNeed } of legalSelections) {
    for (const effect of effectsFor(strategy, game.situation, prepared.eventOverride, boostedNeed)) {
      if (effect.amount > 0) publicStrength.set(effect.need, (publicStrength.get(effect.need) ?? 0) + effect.amount)
    }
  }

  const publicChanges: PublicNeedChange[] = []
  let sharedEarned = 0
  let cognitions = choices.map((cognition) => ({
    ...cognition,
    publicNeeds: cognition.publicNeeds.map((slot) => {
      const removed = Math.min(slot.gifts, publicStrength.get(slot.card.need) ?? 0)
      const after = slot.gifts - removed
      sharedEarned += removed
      publicChanges.push({
        key: needKey(cognition.id, slot.card.id),
        cognitionId: cognition.id,
        cognitionName: cognition.name,
        need: slot.card.need,
        feeling: slot.card.feeling,
        before: slot.gifts,
        after,
        removed,
        setup: slot.setup,
      })
      return { ...slot, gifts: after }
    }),
    privateNeed: { ...cognition.privateNeed },
  }))

  const privateAwards: PrivateAward[] = []
  cognitions = cognitions.map((cognition) => {
    const totalStrength = legalSelections.reduce((total, { actor, strategy, boostedNeed }) => total + positiveStrength(
      strategy,
      game.situation,
      cognition.privateNeed.card.need,
      prepared.eventOverride,
      actor.id === cognition.id ? boostedNeed : null,
    ), 0)
    const removed = Math.min(cognition.privateNeed.gifts, totalStrength)
    if (removed > 0) privateAwards.push({ cognitionId: cognition.id, cognitionName: cognition.name, need: cognition.privateNeed.card.need, points: removed })
    return {
      ...cognition,
      privateNeed: { ...cognition.privateNeed, gifts: cognition.privateNeed.gifts - removed },
      privateScore: cognition.privateScore + removed,
    }
  })

  const bonusAwards: BonusAward[] = []
  const bonusScoreByCognition = new Map<CognitionId, number>()
  const resolvedBonuses = prepared.bonusNeeds.map((bonus) => {
    if (bonus.gifts === 0 || bonus.availableRound > game.round) return bonus
    const contenders = legalSelections
      .map(({ actor, strategy, boostedNeed }) => ({
        actor,
        strength: positiveStrength(strategy, game.situation, bonus.need, prepared.eventOverride, boostedNeed),
      }))
      .filter(({ strength }) => strength > 0)
    const highest = contenders.reduce((value, contender) => Math.max(value, contender.strength), 0)
    if (highest === 0) return bonus
    const winners = contenders.filter((contender) => contender.strength === highest)
    const pointsEach = Math.min(bonus.gifts, highest)
    for (const winner of winners) bonusScoreByCognition.set(winner.actor.id, (bonusScoreByCognition.get(winner.actor.id) ?? 0) + pointsEach)
    bonusAwards.push({
      bonusId: bonus.id,
      need: bonus.need,
      cognitionIds: winners.map((winner) => winner.actor.id),
      cognitionNames: winners.map((winner) => winner.actor.name),
      pointsEach,
    })
    return { ...bonus, gifts: bonus.gifts - pointsEach }
  })
  cognitions = cognitions.map((cognition) => ({ ...cognition, bonusScore: cognition.bonusScore + (bonusScoreByCognition.get(cognition.id) ?? 0) }))

  const bonusCreated: BonusNeed[] = []
  for (const { actor, strategy, boostedNeed } of legalSelections) {
    effectsFor(strategy, game.situation, prepared.eventOverride, boostedNeed).forEach((effect, index) => {
      if (effect.amount >= 0) return
      const gifts = Math.abs(effect.amount)
      bonusCreated.push({
        id: `${game.situationNumber}-${game.round}-${actor.id}-${strategy.id}-${index}`,
        need: effect.need,
        gifts,
        initialGifts: gifts,
        sourceStrategyId: strategy.id,
        sourceStrategyTitle: strategy.title,
        sourceCognitionId: actor.id,
        sourceCognitionName: actor.name,
        availableRound: game.round + 1,
      })
    })
  }

  const resolutionByCognition: Resolution[] = selected.flatMap(({ actor, commit, strategy, special }) => {
    const displayCard = strategy ?? special
    if (!displayCard) return []
    const privateAllowed = prepared.groupPrivate || prepared.privateActors.has(actor.id)
    const boostedNeed = commit.specialId === 'SA7' ? prepared.boosts.get(actor.id) ?? null : null
    const legal = strategy
      ? preparedCanPlay(actor, strategy, bonusesBefore, game.situation, prepared.eventOverride, privateAllowed, boostedNeed)
      : Boolean(special)
    const effects = strategy && legal
      ? effectsFor(strategy, game.situation, prepared.eventOverride, boostedNeed).filter((effect) => effect.amount > 0)
      : []
    const publicMatches = unique(effects.flatMap((effect) => publicBefore.some(({ slot }) => slot.gifts > 0 && slot.card.need === effect.need) ? [effect.need] : []))
    const privateMatches = unique(effects.flatMap((effect) => choices.some((target) => target.privateNeed.gifts > 0 && target.privateNeed.card.need === effect.need) ? [effect.need] : []))
    const bonusMatches = unique(effects.flatMap((effect) => bonusesBefore.some((bonus) => bonus.gifts > 0 && bonus.need === effect.need) ? [effect.need] : []))
    const actorCreated = bonusCreated.filter((bonus) => bonus.sourceCognitionId === actor.id && bonus.sourceStrategyId === strategy?.id)
    const shared = effects.reduce((total, effect) => total + publicBefore.reduce((subtotal, { slot }) => slot.gifts > 0 && slot.card.need === effect.need ? subtotal + Math.min(slot.gifts, effect.amount) : subtotal, 0), 0)
    const privatePoints = effects.reduce((total, effect) => total + choices.reduce((subtotal, target) => target.privateNeed.gifts > 0 && target.privateNeed.card.need === effect.need ? subtotal + Math.min(target.privateNeed.gifts, effect.amount) : subtotal, 0), 0)
    const specialUse = prepared.uses.find((use) => use.cognitionId === actor.id && use.card.id === special?.id)
    return [{
      cognitionId: actor.id,
      cognitionName: actor.name,
      strategy: displayCard,
      specialAction: special ?? undefined,
      specialSummary: specialUse?.summary,
      legal,
      shared,
      private: privatePoints,
      publicMatches,
      privateMatches,
      bonusMatches,
      bonusCreated: actorCreated,
      story: simpleStory(actor, displayCard, game.situation, legal, specialUse?.summary),
    }]
  })
  const resolution = [
    ...resolutionByCognition.filter((line) => line.cognitionId !== 'alpha'),
    ...resolutionByCognition.filter((line) => line.cognitionId === 'alpha'),
  ]

  const complete = cognitions.every((cognition) => cognition.publicNeeds.every((slot) => slot.gifts === 0))
  const sharedAfter = game.sharedScore + sharedEarned
  return {
    ...game,
    cognitions,
    needDeck: prepared.needDeck,
    bonusNeeds: [...resolvedBonuses.filter((bonus) => bonus.gifts > 0), ...bonusCreated],
    sharedScore: sharedAfter,
    phase: complete ? 'complete' : 'revealed',
    resolution,
    roundLedger: {
      publicChanges,
      publicRemoved: sharedEarned,
      sharedBefore: game.sharedScore,
      sharedAfter,
      privateAwards,
      bonusAwards,
      bonusCreated,
      specialActions: prepared.uses,
    },
  }
}

function refill(cognitions: Cognition[], deckInput: StrategyCard[]): [Cognition[], StrategyCard[]] {
  let deck = [...deckInput]
  const committed = cognitions.flatMap((cognition) => {
    const selection = parseCommit(cognition.selected)
    return [selection.strategyId, selection.specialId].filter((id): id is string => Boolean(id))
  })
  const used = new Set(committed)
  const next = cognitions.map((cognition) => {
    const selection = parseCommit(cognition.selected)
    const removed = new Set([selection.strategyId, selection.specialId].filter((id): id is string => Boolean(id)))
    let hand = cognition.hand.filter((card) => !removed.has(card.id))
    while (hand.length < 4) {
      const unavailable = new Set(cognitions.flatMap((item) => item.hand.map((card) => card.id)))
      const recycle = allStrategyCards.filter((candidate) => !used.has(candidate.id) && !unavailable.has(candidate.id) && !hand.some((card) => card.id === candidate.id))
      const [card, rest] = draw(deck.filter((candidate) => !hand.some((held) => held.id === candidate.id)), recycle)
      hand = [...hand, card]
      deck = rest
    }
    return { ...cognition, hand, selected: null, privateVisible: false }
  })
  return [next, deck]
}

export function continueRound(game: GameState): GameState {
  const [cognitions, strategyDeck] = refill(game.cognitions, game.strategyDeck)
  return {
    ...game,
    cognitions,
    strategyDeck,
    bonusNeeds: game.bonusNeeds.filter((bonus) => bonus.gifts > 0),
    round: game.round + 1,
    phase: 'planning',
    resolution: [],
    roundLedger: null,
  }
}

export function nextSituation(game: GameState): GameState {
  const heldStrategyIds = new Set(game.cognitions.flatMap((cognition) => cognition.hand.map((card) => card.id)))
  let strategyDeck = shuffle(allStrategyCards.filter((card) => !heldStrategyIds.has(card.id)))
  let needDeck = shuffle(needs)
  let situationDeck = shuffle(game.situationDeck.length ? game.situationDeck : situations.filter((card) => card.id !== game.situation.id))
  let situation: SituationCard
  ;[situation, situationDeck] = draw(situationDeck, situations.filter((card) => card.id !== game.situation.id))

  const refreshed = game.cognitions.map((cognition) => {
    let privateNeed = cognition.privateNeed
    const excluded = new Set<string>()
    if (privateNeed.gifts === 0) {
      let card: NeedCard
      ;[card, needDeck] = drawNeedAvoiding(needDeck, excluded)
      privateNeed = { card, gifts: 1, setup: baseSetup() }
    }
    excluded.add(privateNeed.card.id)
    const publicNeeds: NeedSlot[] = []
    while (publicNeeds.length < 2) {
      let card: NeedCard
      ;[card, needDeck] = drawNeedAvoiding(needDeck, new Set([...excluded, ...publicNeeds.map((slot) => slot.card.id)]))
      publicNeeds.push({ card, gifts: 1, setup: baseSetup() })
    }
    return { ...cognition, privateNeed, publicNeeds, selected: null, privateVisible: false, magnifierUsed: false }
  })
  const [withHands, remainingStrategyDeck] = refill(refreshed, strategyDeck)
  strategyDeck = remainingStrategyDeck
  return {
    ...game,
    cognitions: applySituation(withHands, situation),
    situation,
    situationDeck,
    needDeck,
    strategyDeck,
    bonusNeeds: [],
    situationNumber: game.situationNumber + 1,
    round: 1,
    phase: 'planning',
    resolution: [],
    roundLedger: null,
  }
}
