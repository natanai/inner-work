import { specialActions, strategies, type StrategyCard } from '../data/cards'

export type SpecialActionId = 'SA1' | 'SA2' | 'SA3' | 'SA4' | 'SA5' | 'SA6' | 'SA7'

export type SpecialActionCard = StrategyCard & {
  id: SpecialActionId
  specialAction: true
  rules: string
}

export const specialStrategyCards: SpecialActionCard[] = specialActions.map((card) => ({
  ...card,
  id: card.id as SpecialActionId,
  effects: [],
  eventEffects: [],
  specialAction: true,
}))

/**
 * Production rollout gate.
 *
 * This branch validates Effective Communication in isolation. No other Special
 * Action may enter a hand through this build.
 */
export const enabledSpecialActionIds: readonly SpecialActionId[] = ['SA5']
export const enabledSpecialStrategyCards = specialStrategyCards.filter((card) => enabledSpecialActionIds.includes(card.id))

/** Cards that may actually be shuffled into a new game in this build. */
export const allStrategyCards: StrategyCard[] = [...strategies, ...enabledSpecialStrategyCards]

/** Full catalog retained for rendering archived games and isolated tests. */
export const completeStrategyCatalog: StrategyCard[] = [...strategies, ...specialStrategyCards]

export function isSpecialAction(card: StrategyCard | null | undefined): card is SpecialActionCard {
  return Boolean(card && card.id.startsWith('SA'))
}

export function specialActionById(id: string | null | undefined): SpecialActionCard | null {
  if (!id) return null
  return specialStrategyCards.find((card) => card.id === id) ?? null
}

export function strategyCardById(id: string | null | undefined): StrategyCard | null {
  if (!id) return null
  return completeStrategyCatalog.find((card) => card.id === id) ?? null
}

export function specialActionSummary(card: SpecialActionCard): string {
  switch (card.id) {
    case 'SA1': return 'Replace any one Public Need with a newly drawn Public Need.'
    case 'SA2': return 'Your paired Strategy may qualify through your own Private Need.'
    case 'SA3': return 'Every Cognition may qualify its paired Strategy through its own Private Need this round.'
    case 'SA4': return 'Draw two Need cards and place them as active Bonus Needs before Strategies resolve.'
    case 'SA5': return 'Place an active Bonus Need for Understanding before Strategies resolve.'
    case 'SA6': return 'Activate every paired Strategy’s Event effects for this round.'
    case 'SA7': return 'Add +3 to one positive effect on your paired Strategy.'
  }
}

export function specialActionNeedsTarget(card: SpecialActionCard): boolean {
  return card.id === 'SA1' || card.id === 'SA7'
}
