import type { Cognition, CognitionId } from './model'

export type CognitionIdentity = {
  id: CognitionId
  symbol: '1' | '2' | '3'
  role: 'You' | 'NPC'
  name: string
  display: string
}

const seatSymbols: Record<CognitionId, CognitionIdentity['symbol']> = {
  alpha: '1',
  beta: '2',
  gamma: '3',
}

const fallbackNames: Record<CognitionId, string> = {
  alpha: 'Alpha',
  beta: 'Beta',
  gamma: 'Delta',
}

let registeredNames: Partial<Record<CognitionId, string>> = {}

/**
 * Some story and ledger records retain an internal Cognition id rather than
 * the whole Cognition object. Register the active game's names so those views
 * still display the same randomized identity.
 */
export function registerCognitionNames(cognitions: ReadonlyArray<Pick<Cognition, 'id' | 'name'>>): void {
  registeredNames = Object.fromEntries(cognitions.map((cognition) => [cognition.id, cognition.name])) as Partial<Record<CognitionId, string>>
}

export function cognitionIdentity(value: Cognition | CognitionId): CognitionIdentity {
  const cognition = typeof value === 'string' ? null : value
  const id = typeof value === 'string' ? value : value.id
  const name = cognition?.name ?? registeredNames[id] ?? fallbackNames[id]
  const role = cognition ? (cognition.human ? 'You' : 'NPC') : (id === 'alpha' ? 'You' : 'NPC')
  return {
    id,
    symbol: seatSymbols[id],
    role,
    name,
    display: `${role} · ${name}`,
  }
}

export function cognitionSymbol(value: Cognition | CognitionId): CognitionIdentity['symbol'] {
  return cognitionIdentity(value).symbol
}

export function cognitionDisplay(value: Cognition | CognitionId): string {
  return cognitionIdentity(value).display
}
