import { specialActions, strategies, type StrategyCard } from '../data/cards'

export type SpecialActionId = 'SA1' | 'SA2' | 'SA3' | 'SA4' | 'SA5' | 'SA6' | 'SA7'
export type SpecialActionTiming = 'Discussion Phase' | 'Start of Play Phase'

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
 * Production Special Action deck.
 *
 * All seven source cards are enabled only alongside the executable regression
 * suite. Keeping this as an explicit list prevents a malformed data row or a
 * future draft card from entering normal deals accidentally.
 */
export const enabledSpecialActionIds: readonly SpecialActionId[] = ['SA1', 'SA2', 'SA3', 'SA4', 'SA5', 'SA6', 'SA7']
export const enabledSpecialStrategyCards = specialStrategyCards.filter((card) => enabledSpecialActionIds.includes(card.id))

/** Cards that may actually be shuffled into a new game in this build. */
export const allStrategyCards: StrategyCard[] = [...strategies, ...enabledSpecialStrategyCards]

/** Full catalog retained for rendering saved or archived games. */
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

export function specialActionTiming(card: SpecialActionCard): SpecialActionTiming {
  return card.id === 'SA2' || card.id === 'SA7' ? 'Start of Play Phase' : 'Discussion Phase'
}

export function specialActionRequiresStrategy(card: SpecialActionCard): boolean {
  return card.id === 'SA2' || card.id === 'SA7'
}

export function specialActionSummary(card: SpecialActionCard): string {
  switch (card.id) {
    case 'SA1': return 'Replace any one Public Need with a newly drawn Public Need.'
    case 'SA2': return 'Your ordinary Strategy may qualify through your own Private Need.'
    case 'SA3': return 'Every Cognition may qualify an ordinary Strategy through its own Private Need this round.'
    case 'SA4': return 'Draw two Need cards and place them as active Bonus Needs before ordinary Strategies resolve.'
    case 'SA5': return 'Place an active Bonus Need for Understanding before ordinary Strategies resolve.'
    case 'SA6': return 'Activate the Event effects on every ordinary Strategy played this round.'
    case 'SA7': return 'Add +3 to one positive effect on your ordinary Strategy.'
  }
}

export function specialActionNeedsTarget(card: SpecialActionCard): boolean {
  return card.id === 'SA1' || card.id === 'SA7'
}
