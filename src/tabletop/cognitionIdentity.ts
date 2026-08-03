import type { Cognition, CognitionId } from './model'

export type CognitionIdentity = {
  id: CognitionId
  symbol: 'α' | 'β' | 'γ'
  role: 'You' | 'NPC'
  name: string
  display: string
}

const identities: Record<CognitionId, CognitionIdentity> = {
  alpha: { id: 'alpha', symbol: 'α', role: 'You', name: 'Cognition α', display: 'You · Cognition α' },
  beta: { id: 'beta', symbol: 'β', role: 'NPC', name: 'Cognition β', display: 'NPC · Cognition β' },
  gamma: { id: 'gamma', symbol: 'γ', role: 'NPC', name: 'Cognition γ', display: 'NPC · Cognition γ' },
}

export function cognitionIdentity(value: Cognition | CognitionId): CognitionIdentity {
  return identities[typeof value === 'string' ? value : value.id]
}

export function cognitionSymbol(value: Cognition | CognitionId): CognitionIdentity['symbol'] {
  return cognitionIdentity(value).symbol
}

export function cognitionDisplay(value: Cognition | CognitionId): string {
  return cognitionIdentity(value).display
}
