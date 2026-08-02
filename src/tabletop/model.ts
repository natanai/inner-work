import { needs, situations, strategies, type Effect, type NeedCard, type SituationCard, type StrategyCard } from '../data/cards'

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
export type Resolution = {
  cognitionId: CognitionId
  cognitionName: string
  strategy: StrategyCard
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

function effectsFor(strategy: StrategyCard, situation: SituationCard): Effect[] {
  return situation.event ? [...strategy.effects, ...strategy.eventEffects] : strategy.effects
}

function positiveStrength(strategy: StrategyCard, situation: SituationCard, need: string): number {
  return effectsFor(strategy, situation)
    .filter((effect) => effect.need === need && effect.amount > 0)
    .reduce((total, effect) => total + effect.amount, 0)
}

export function createGame(): GameState {
  let needDeck = shuffle(needs)
  let strategyDeck = shuffle(strategies)
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
  return strategy.effects.some((effect) => effect.amount > 0 && (
    cognition.publicNeeds.some((slot) => slot.gifts > 0 && slot.card.need === effect.need)
    || bonusNeeds.some((bonus) => bonus.gifts > 0 && bonus.need === effect.need)
  ))
}

function npcValue(cognition: Cognition, all: Cognition[], strategy: StrategyCard, game: GameState): number {
  const bonuses = activeBonusNeeds(game)
  if (!canPlay(cognition, strategy, bonuses)) return Number.NEGATIVE_INFINITY
  let shared = 0
  let ownPublic = 0
  let ownPrivate = 0
  let bonus = 0
  for (const effect of effectsFor(strategy, game.situation)) {
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

function chooseNpc(cognition: Cognition, all: Cognition[], game: GameState): string | null {
  const ranked = cognition.hand
    .map((strategy) => ({ strategy, score: npcValue(cognition, all, strategy, game) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score)
  return ranked[0]?.strategy.id ?? cognition.hand[Math.floor(Math.random() * cognition.hand.length)]?.id ?? null
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

function needPhrase(needsToName: string[]): string {
  const values = unique(needsToName)
  return values.length === 1 ? `the need for ${values[0]}` : `the needs for ${joinNatural(values)}`
}

function ownedNeedPhrase(needsToName: string[]): string {
  const values = unique(needsToName)
  return values.length === 1 ? `need for ${values[0]}` : `needs for ${joinNatural(values)}`
}

function actionPhrase(title: string): string {
  const cleaned = title.replace(/[.!?]+$/, '')
  return cleaned ? cleaned[0].toLowerCase() + cleaned.slice(1) : title
}

function collectiveStory(
  situation: SituationCard,
  actor: Cognition,
  strategy: StrategyCard,
  publicBefore: Array<{ cognition: Cognition; slot: NeedSlot }>,
  choices: Cognition[],
  bonusesBefore: BonusNeed[],
  bonusCreated: BonusNeed[],
): string {
  const effects = effectsFor(strategy, situation).filter((effect) => effect.amount > 0)
  const matchesNeed = (need: string) => effects.some((effect) => effect.need === need)
  const ownPublic = unique(publicBefore
    .filter(({ cognition, slot }) => cognition.id === actor.id && slot.gifts > 0 && matchesNeed(slot.card.need))
    .map(({ slot }) => slot.card.need))

  const otherPublic = new Map<string, string[]>()
  for (const { cognition, slot } of publicBefore) {
    if (cognition.id === actor.id || slot.gifts === 0 || !matchesNeed(slot.card.need)) continue
    otherPublic.set(cognition.name, unique([...(otherPublic.get(cognition.name) ?? []), slot.card.need]))
  }

  const privateOwners = unique(choices
    .filter((cognition) => cognition.privateNeed.gifts > 0 && matchesNeed(cognition.privateNeed.card.need))
    .map((cognition) => cognition.name))
  const matchedBonuses = bonusesBefore.filter((bonus) => bonus.gifts > 0 && matchesNeed(bonus.need))

  const motivation = ownPublic.length > 0
    ? `${actor.name} brought forward ${needPhrase(ownPublic)}`
    : matchedBonuses.length > 0
      ? `${actor.name} recognized ${matchedBonuses.length === 1 ? 'the active Bonus Need' : 'the active Bonus Needs'} for ${joinNatural(matchedBonuses.map((bonus) => bonus.need))}`
      : `${actor.name} brought forward this Strategy`

  const opening = `${motivation}. That influenced the whole psyche to choose a shared action: the person chose to ${actionPhrase(strategy.title)} during “${situation.title}.”`
  const consequences: string[] = []

  for (const [cognitionName, needsTended] of otherPublic) {
    consequences.push(`It also tended ${cognitionName}’s ${ownedNeedPhrase(needsTended)}`)
  }

  if (privateOwners.length > 0) {
    const ownerText = privateOwners.length === 1 ? privateOwners[0] : joinNatural(privateOwners)
    consequences.push(`It also quietly tended a hidden Private Need held by ${ownerText}`)
  }

  for (const bonus of matchedBonuses) {
    consequences.push(`It also tended the active Bonus Need for ${bonus.need}, introduced when ${bonus.sourceCognitionName} brought forward “${bonus.sourceStrategyTitle}”`)
  }

  if (bonusCreated.length > 0) {
    const created = joinNatural(bonusCreated.map((bonus) => bonus.need))
    consequences.push(`This shared action also introduced ${bonusCreated.length === 1 ? 'a new Bonus Need' : 'new Bonus Needs'} for ${created}, which will enter play next round`)
  }

  return `${opening}${consequences.length ? ` ${consequences.join('. ')}.` : ''}`
}

export function resolveRound(game: GameState): GameState {
  const bonusesBefore = activeBonusNeeds(game)
  const choices = game.cognitions.map((cognition) => cognition.human
    ? cognition
    : { ...cognition, selected: chooseNpc(cognition, game.cognitions, game) })
  const selected = choices.map((actor) => ({
    actor,
    strategy: actor.hand.find((card) => card.id === actor.selected) ?? null,
  }))
  const legalSelections = selected.filter(({ actor, strategy }) => strategy && canPlay(actor, strategy, bonusesBefore)) as Array<{ actor: Cognition; strategy: StrategyCard }>

  const publicBefore = choices.flatMap((cognition) => cognition.publicNeeds.map((slot) => ({ cognition, slot })))
  const publicStrength = new Map<string, number>()
  for (const { strategy } of legalSelections) {
    for (const effect of effectsFor(strategy, game.situation)) {
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
    const totalStrength = legalSelections.reduce((total, { strategy }) => total + positiveStrength(strategy, game.situation, cognition.privateNeed.card.need), 0)
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
  const resolvedBonuses = game.bonusNeeds.map((bonus) => {
    if (bonus.gifts === 0 || bonus.availableRound > game.round) return bonus
    const contenders = legalSelections
      .map(({ actor, strategy }) => ({ actor, strength: positiveStrength(strategy, game.situation, bonus.need) }))
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
  for (const { actor, strategy } of legalSelections) {
    effectsFor(strategy, game.situation).forEach((effect, index) => {
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

  const resolutionByCognition: Resolution[] = selected.flatMap(({ actor, strategy }) => {
    if (!strategy) return []
    const legal = canPlay(actor, strategy, bonusesBefore)
    const effects = effectsFor(strategy, game.situation).filter((effect) => effect.amount > 0)
    const publicMatches = unique(effects.flatMap((effect) => publicBefore.some(({ slot }) => slot.gifts > 0 && slot.card.need === effect.need) ? [effect.need] : []))
    const privateMatches = unique(effects.flatMap((effect) => choices.some((target) => target.privateNeed.gifts > 0 && target.privateNeed.card.need === effect.need) ? [effect.need] : []))
    const bonusMatches = unique(effects.flatMap((effect) => bonusesBefore.some((bonus) => bonus.gifts > 0 && bonus.need === effect.need) ? [effect.need] : []))
    const actorCreated = bonusCreated.filter((bonus) => bonus.sourceCognitionId === actor.id && bonus.sourceStrategyId === strategy.id)
    const shared = legal ? effects.reduce((total, effect) => total + publicBefore.reduce((subtotal, { slot }) => slot.gifts > 0 && slot.card.need === effect.need ? subtotal + Math.min(slot.gifts, effect.amount) : subtotal, 0), 0) : 0
    const privatePoints = legal ? effects.reduce((total, effect) => total + choices.reduce((subtotal, target) => target.privateNeed.gifts > 0 && target.privateNeed.card.need === effect.need ? subtotal + Math.min(target.privateNeed.gifts, effect.amount) : subtotal, 0), 0) : 0
    return [{
      cognitionId: actor.id,
      cognitionName: actor.name,
      strategy,
      legal,
      shared,
      private: privatePoints,
      publicMatches,
      privateMatches,
      bonusMatches,
      bonusCreated: actorCreated,
      story: legal
        ? collectiveStory(game.situation, actor, strategy, publicBefore, choices, bonusesBefore, actorCreated)
        : `${actor.name} could not bring “${strategy.title}” into the shared action because it did not tend one of that Cognition’s own Public Needs or an active Bonus Need. The card was discarded.`,
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
    },
  }
}

function refill(cognitions: Cognition[], deckInput: StrategyCard[]): [Cognition[], StrategyCard[]] {
  let deck = deckInput
  const used = new Set(cognitions.flatMap((cognition) => cognition.selected ? [cognition.selected] : []))
  const next = cognitions.map((cognition) => {
    let hand = cognition.hand.filter((card) => card.id !== cognition.selected)
    while (hand.length < 4) {
      const [card, rest] = draw(deck, strategies.filter((candidate) => !used.has(candidate.id)))
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
  let needDeck = game.needDeck
  let situationDeck = game.situationDeck
  let situation: SituationCard
  ;[situation, situationDeck] = draw(situationDeck, situations.filter((card) => card.id !== game.situation.id))

  const refreshed = game.cognitions.map((cognition) => {
    let privateNeed = cognition.privateNeed
    if (privateNeed.gifts === 0) {
      let card: NeedCard
      ;[card, needDeck] = draw(needDeck, needs)
      privateNeed = { card, gifts: 1, setup: baseSetup() }
    }
    const publicNeeds: NeedSlot[] = []
    while (publicNeeds.length < 2) {
      let card: NeedCard
      ;[card, needDeck] = draw(needDeck, needs)
      if (card.id !== privateNeed.card.id && !publicNeeds.some((slot) => slot.card.id === card.id)) {
        publicNeeds.push({ card, gifts: 1, setup: baseSetup() })
      }
    }
    return { ...cognition, privateNeed, publicNeeds, selected: null, privateVisible: false, magnifierUsed: false }
  })
  const [withHands, strategyDeck] = refill(refreshed, game.strategyDeck)
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
