import type { CognitionId, GameState, GiftSetup, NeedSlot } from './model'

function privateSetup(): GiftSetup {
  return { base: 1, situation: 0, multiplied: false, total: 1 }
}

function publicSetup(game: GameState, slot: NeedSlot): NeedSlot {
  const situationGift = Math.max(0, game.situation.effects.find((effect) => effect.need === slot.card.need)?.amount ?? 0)
  const multiplied = slot.card.feeling === game.situation.feelingMultiplier
  const subtotal = 1 + situationGift
  const total = multiplied ? subtotal * 2 : subtotal
  return {
    card: slot.card,
    gifts: total,
    setup: {
      base: 1,
      situation: situationGift,
      multiplied,
      total,
    },
  }
}

export function privateNeedCandidates(game: GameState, cognitionId: CognitionId = 'alpha'): NeedSlot[] {
  const cognition = game.cognitions.find((entry) => entry.id === cognitionId)
  if (!cognition) return []
  return [cognition.privateNeed, ...cognition.publicNeeds]
}

export function choosePrivateNeed(game: GameState, cardId: string, cognitionId: CognitionId = 'alpha'): GameState {
  const candidates = privateNeedCandidates(game, cognitionId)
  const selected = candidates.find((slot) => slot.card.id === cardId)
  if (!selected) return game

  return {
    ...game,
    cognitions: game.cognitions.map((cognition) => {
      if (cognition.id !== cognitionId) return cognition
      return {
        ...cognition,
        privateNeed: {
          card: selected.card,
          gifts: 1,
          setup: privateSetup(),
        },
        publicNeeds: candidates
          .filter((slot) => slot.card.id !== cardId)
          .map((slot) => publicSetup(game, slot)),
        privateVisible: false,
        magnifierUsed: false,
        selected: null,
      }
    }),
  }
}
