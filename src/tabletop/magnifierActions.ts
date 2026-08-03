import { needs, strategies, type NeedCard, type StrategyCard } from '../data/cards'
import type { Cognition, CognitionId, GameState, GiftSetup, NeedSlot } from './model'

export type MagnifierResult = {
  game: GameState
  message: string
  accepted: boolean
}

function setupFor(card: NeedCard, game: GameState): GiftSetup {
  const situation = Math.max(0, game.situation.effects.find((effect) => effect.need === card.need)?.amount ?? 0)
  const multiplied = card.feeling === game.situation.feelingMultiplier
  const subtotal = 1 + situation
  return {
    base: 1,
    situation,
    multiplied,
    total: multiplied ? subtotal * 2 : subtotal,
  }
}

function slotFor(card: NeedCard, game: GameState): NeedSlot {
  const setup = setupFor(card, game)
  return { card, gifts: setup.total, setup }
}

function drawStrategies(game: GameState, count: number, excluded: Set<string>): [StrategyCard[], StrategyCard[]] {
  let deck = game.strategyDeck.filter((card) => !excluded.has(card.id))
  const drawn: StrategyCard[] = []
  const held = new Set(game.cognitions.flatMap((cognition) => cognition.hand.map((card) => card.id)))

  while (drawn.length < count) {
    if (deck.length === 0) {
      deck = strategies.filter((card) => !excluded.has(card.id) && !held.has(card.id) && !drawn.some((item) => item.id === card.id))
    }
    const card = deck.shift()
    if (!card) break
    drawn.push(card)
  }
  return [drawn, deck]
}

function drawNeeds(game: GameState, count: number): [NeedCard[], NeedCard[]] {
  const inPlay = new Set(game.cognitions.flatMap((cognition) => [
    cognition.privateNeed.card.id,
    ...cognition.publicNeeds.map((slot) => slot.card.id),
  ]))
  let deck = game.needDeck.filter((card) => !inPlay.has(card.id))
  const drawn: NeedCard[] = []

  while (drawn.length < count) {
    if (deck.length === 0) {
      deck = needs.filter((card) => !inPlay.has(card.id) && !drawn.some((item) => item.id === card.id))
    }
    const card = deck.shift()
    if (!card) break
    drawn.push(card)
  }
  return [drawn, deck]
}

function cardStrength(card: StrategyCard, need: string, event: boolean): number {
  const effects = event ? [...card.effects, ...card.eventEffects] : card.effects
  return effects
    .filter((effect) => effect.need === need && effect.amount > 0)
    .reduce((total, effect) => total + effect.amount, 0)
}

function coverage(cognition: Cognition, cards: NeedCard[], game: GameState): number {
  return cognition.hand.reduce((total, strategy) => {
    const matches = cards.filter((need) => cardStrength(strategy, need.need, game.situation.event) > 0).length
    return total + matches
  }, 0)
}

export function replaceStrategiesWithMagnifier(game: GameState, cognitionId: CognitionId, cardIds: string[]): MagnifierResult {
  const cognition = game.cognitions.find((item) => item.id === cognitionId)
  const ids = new Set(cardIds)
  if (!cognition || cognition.magnifierUsed || game.phase !== 'planning' || ids.size === 0) {
    return { game, accepted: false, message: 'Choose at least one Strategy before using the magnifier.' }
  }

  const cardsToReplace = cognition.hand.filter((card) => ids.has(card.id))
  const [replacements, strategyDeck] = drawStrategies(game, cardsToReplace.length, ids)
  if (replacements.length !== cardsToReplace.length) {
    return { game, accepted: false, message: 'The Strategy deck could not supply enough replacement cards.' }
  }

  let cursor = 0
  const next = {
    ...game,
    strategyDeck,
    cognitions: game.cognitions.map((item) => item.id === cognitionId ? {
      ...item,
      magnifierUsed: true,
      selected: ids.has(item.selected ?? '') ? null : item.selected,
      hand: item.hand.map((card) => ids.has(card.id) ? replacements[cursor++] : card),
    } : item),
  }

  return {
    game: next,
    accepted: true,
    message: `Replaced ${cardsToReplace.length} Strategy card${cardsToReplace.length === 1 ? '' : 's'}.`,
  }
}

function replaceNeed(game: GameState, targetId: CognitionId, cardId: string, spendMagnifier: boolean): MagnifierResult {
  const target = game.cognitions.find((cognition) => cognition.id === targetId)
  if (!target || !target.publicNeeds.some((slot) => slot.card.id === cardId)) {
    return { game, accepted: false, message: 'That Public Need is no longer available.' }
  }

  const [drawn, needDeck] = drawNeeds(game, 2)
  if (drawn.length !== 2) return { game, accepted: false, message: 'The Need deck could not supply two replacements.' }

  const replacementSlots = drawn.map((card) => slotFor(card, game))
  const next = {
    ...game,
    needDeck,
    cognitions: game.cognitions.map((cognition) => {
      if (cognition.id === targetId) {
        return {
          ...cognition,
          selected: null,
          publicNeeds: cognition.publicNeeds.flatMap((slot) => slot.card.id === cardId ? replacementSlots : [slot]),
        }
      }
      if (spendMagnifier && cognition.human) return { ...cognition, magnifierUsed: true, selected: null }
      return cognition
    }),
  }

  return {
    game: next,
    accepted: true,
    message: `${target.name} replaced one Public Need with ${drawn.map((card) => card.need).join(' and ')}.`,
  }
}

export function replaceOwnPublicNeedWithMagnifier(game: GameState, cardId: string): MagnifierResult {
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player || player.magnifierUsed || game.phase !== 'planning') {
    return { game, accepted: false, message: 'The magnifier is not available.' }
  }
  return replaceNeed(game, player.id, cardId, true)
}

export function requestNpcPublicNeedReplacement(game: GameState, targetId: CognitionId, cardId: string): MagnifierResult {
  const player = game.cognitions.find((cognition) => cognition.human)
  const target = game.cognitions.find((cognition) => cognition.id === targetId && !cognition.human)
  const current = target?.publicNeeds.find((slot) => slot.card.id === cardId)
  if (!player || !target || !current || player.magnifierUsed || game.phase !== 'planning') {
    return { game, accepted: false, message: 'That request is not available.' }
  }

  const [candidates] = drawNeeds(game, 2)
  if (candidates.length !== 2) return { game, accepted: false, message: 'The Need deck could not supply two replacements.' }

  const before = coverage(target, [current.card], game)
  const after = coverage(target, candidates, game)
  const accepted = after >= before
  if (!accepted) {
    return {
      game,
      accepted: false,
      message: `${target.name} declined. Its hidden hand currently has more ways to work with ${current.card.need}. The magnifier was not spent.`,
    }
  }

  const result = replaceNeed(game, target.id, cardId, true)
  return {
    ...result,
    message: `${target.name} agreed because the replacement creates at least as many possible Strategy connections. ${result.message}`,
  }
}

export function beginPrivateReviewWithMagnifier(game: GameState): MagnifierResult {
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player || player.magnifierUsed || game.phase !== 'planning') {
    return { game, accepted: false, message: 'The magnifier is not available.' }
  }
  return {
    accepted: true,
    message: 'The Private Need is visible until you return it face down.',
    game: {
      ...game,
      cognitions: game.cognitions.map((cognition) => cognition.id === player.id
        ? { ...cognition, magnifierUsed: true, privateVisible: true }
        : cognition),
    },
  }
}

export function endPrivateReview(game: GameState): GameState {
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player) return game
  return {
    ...game,
    cognitions: game.cognitions.map((cognition) => cognition.id === player.id
      ? { ...cognition, privateVisible: false }
      : cognition),
  }
}
