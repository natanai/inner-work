import { needs, situations, strategies, type NeedCard, type SituationCard, type StrategyCard } from '../data/cards'

export type Phase = 'planning' | 'revealed' | 'complete'
export type CognitionId = 'alpha' | 'beta' | 'gamma'
export type NeedSlot = { card: NeedCard; gifts: number }
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
}
export type Resolution = {
  cognitionId: CognitionId
  cognitionName: string
  strategy: StrategyCard
  legal: boolean
  shared: number
  private: number
  story: string
}
export type GameState = {
  cognitions: Cognition[]
  situation: SituationCard
  situationDeck: SituationCard[]
  needDeck: NeedCard[]
  strategyDeck: StrategyCard[]
  sharedScore: number
  situationNumber: number
  round: number
  phase: Phase
  resolution: Resolution[]
}

const templates = [
  { id: 'alpha' as const, name: 'Cognition α', human: true },
  { id: 'beta' as const, name: 'Cognition β', human: false, style: 'shared' as const },
  { id: 'gamma' as const, name: 'Cognition γ', human: false, style: 'self' as const },
]

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

function situationGifts(card: NeedCard, situation: SituationCard): number {
  const added = situation.effects.find((effect) => effect.need === card.need)?.amount ?? 0
  const base = 1 + Math.max(0, added)
  return card.feeling === situation.feelingMultiplier ? base * 2 : base
}

function applySituation(cognitions: Cognition[], situation: SituationCard): Cognition[] {
  return cognitions.map((cognition) => ({
    ...cognition,
    magnifierUsed: false,
    privateVisible: false,
    selected: null,
    publicNeeds: cognition.publicNeeds.map((slot) => ({
      card: slot.card,
      gifts: situationGifts(slot.card, situation),
    })),
  }))
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
      publicNeeds: dealtNeeds.slice(1).map((card) => ({ card, gifts: 1 })),
      privateNeed: { card: dealtNeeds[0], gifts: 1 },
      privateVisible: false,
      magnifierUsed: false,
      hand,
      selected: null,
      privateScore: 0,
    }
  })

  return {
    cognitions: applySituation(cognitions, situation),
    situation,
    situationDeck,
    needDeck,
    strategyDeck,
    sharedScore: 0,
    situationNumber: 1,
    round: 1,
    phase: 'planning',
    resolution: [],
  }
}

export function canPlay(cognition: Cognition, strategy: StrategyCard): boolean {
  return strategy.effects.some((effect) =>
    effect.amount > 0 && cognition.publicNeeds.some((slot) => slot.gifts > 0 && slot.card.need === effect.need),
  )
}

function npcValue(cognition: Cognition, all: Cognition[], strategy: StrategyCard): number {
  if (!canPlay(cognition, strategy)) return Number.NEGATIVE_INFINITY
  let shared = 0
  let ownPublic = 0
  let ownPrivate = 0
  let harm = 0
  for (const effect of strategy.effects) {
    if (effect.amount > 0) {
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
    } else {
      harm += Math.abs(effect.amount)
    }
  }
  const wobble = Math.random() * .35
  return cognition.style === 'self'
    ? ownPublic * 5 + ownPrivate * 4 + shared * 1.4 - harm * 5 + wobble
    : shared * 5 + ownPublic * 1.5 + ownPrivate * 2 - harm * 5 + wobble
}

function chooseNpc(cognition: Cognition, all: Cognition[]): string | null {
  const ranked = cognition.hand
    .map((strategy) => ({ strategy, score: npcValue(cognition, all, strategy) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score)
  return ranked[0]?.strategy.id ?? cognition.hand[Math.floor(Math.random() * cognition.hand.length)]?.id ?? null
}

function story(situation: SituationCard, cognition: Cognition, strategy: StrategyCard): string {
  const tended = strategy.effects.filter((effect) => effect.amount > 0).map((effect) => effect.need).slice(0, 3)
  return `${cognition.name} responded to “${situation.title}” with “${strategy.title},” tending to ${tended.join(', ') || 'an unnamed need'}.`
}

export function resolveRound(game: GameState): GameState {
  const choices = game.cognitions.map((cognition) => cognition.human
    ? cognition
    : { ...cognition, selected: chooseNpc(cognition, game.cognitions) })
  let cognitions = choices.map((cognition) => ({
    ...cognition,
    publicNeeds: cognition.publicNeeds.map((slot) => ({ ...slot })),
    privateNeed: { ...cognition.privateNeed },
  }))
  let sharedEarned = 0
  const resolution: Resolution[] = []

  for (const actor of choices) {
    const strategy = actor.hand.find((card) => card.id === actor.selected)
    if (!strategy) continue
    const legal = canPlay(actor, strategy)
    let shared = 0
    let privatePoints = 0

    if (legal) {
      for (const effect of strategy.effects) {
        if (effect.amount > 0) {
          cognitions = cognitions.map((target) => {
            const publicNeeds = target.publicNeeds.map((slot) => {
              if (slot.gifts === 0 || slot.card.need !== effect.need) return slot
              const removed = Math.min(slot.gifts, effect.amount)
              shared += removed
              sharedEarned += removed
              return { ...slot, gifts: slot.gifts - removed }
            })
            let privateNeed = target.privateNeed
            let privateScore = target.privateScore
            if (privateNeed.gifts > 0 && privateNeed.card.need === effect.need) {
              const removed = Math.min(privateNeed.gifts, effect.amount)
              privateNeed = { ...privateNeed, gifts: privateNeed.gifts - removed }
              privateScore += removed
              privatePoints += removed
            }
            return { ...target, publicNeeds, privateNeed, privateScore }
          })
        } else if (effect.amount < 0) {
          cognitions = cognitions.map((target) => ({
            ...target,
            publicNeeds: target.publicNeeds.map((slot) => slot.card.need === effect.need
              ? { ...slot, gifts: slot.gifts + Math.abs(effect.amount) }
              : slot),
          }))
        }
      }
    }

    resolution.push({
      cognitionId: actor.id,
      cognitionName: actor.name,
      strategy,
      legal,
      shared,
      private: privatePoints,
      story: legal ? story(game.situation, actor, strategy) : `${actor.name} discarded “${strategy.title}”; it did not tend one of its own Public Needs.`,
    })
  }

  const complete = cognitions.every((cognition) => cognition.publicNeeds.every((slot) => slot.gifts === 0))
  return {
    ...game,
    cognitions,
    sharedScore: game.sharedScore + sharedEarned,
    phase: complete ? 'complete' : 'revealed',
    resolution,
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
  return { ...game, cognitions, strategyDeck, round: game.round + 1, phase: 'planning', resolution: [] }
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
      privateNeed = { card, gifts: 1 }
    }
    const publicNeeds: NeedSlot[] = []
    while (publicNeeds.length < 2) {
      let card: NeedCard
      ;[card, needDeck] = draw(needDeck, needs)
      if (card.id !== privateNeed.card.id && !publicNeeds.some((slot) => slot.card.id === card.id)) {
        publicNeeds.push({ card, gifts: 1 })
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
    situationNumber: game.situationNumber + 1,
    round: 1,
    phase: 'planning',
    resolution: [],
  }
}
