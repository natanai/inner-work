import type { Cognition, CognitionId } from './model'

export type CognitionSeat = '1' | '2' | '3'

export type CognitionIdentity = {
  id: CognitionId
  seat: CognitionSeat
  /** Compatibility alias. Visual badges should use `seat`. */
  symbol: CognitionSeat
  role: 'You' | 'NPC'
  name: string
  display: string
}

const seats: Record<CognitionId, CognitionSeat> = {
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
 * Story and ledger records sometimes retain only an internal Cognition id.
 * Register the active game's names so every view resolves that id identically.
 */
export function registerCognitionNames(cognitions: ReadonlyArray<Pick<Cognition, 'id' | 'name'>>): void {
  registeredNames = Object.fromEntries(cognitions.map((cognition) => [cognition.id, cognition.name])) as Partial<Record<CognitionId, string>>
}

export function cognitionIdentity(value: Cognition | CognitionId): CognitionIdentity {
  const cognition = typeof value === 'string' ? null : value
  const id = typeof value === 'string' ? value : value.id
  const name = cognition?.name ?? registeredNames[id] ?? fallbackNames[id]
  const role = cognition ? (cognition.human ? 'You' : 'NPC') : (id === 'alpha' ? 'You' : 'NPC')
  const seat = seats[id]
  return {
    id,
    seat,
    symbol: seat,
    role,
    name,
    display: `${role} · ${name}`,
  }
}

export function cognitionSeat(value: Cognition | CognitionId): CognitionSeat {
  return cognitionIdentity(value).seat
}

/** @deprecated Use cognitionSeat. Retained so older components still point to the same source of truth. */
export function cognitionSymbol(value: Cognition | CognitionId): CognitionSeat {
  return cognitionSeat(value)
}

export function cognitionDisplay(value: Cognition | CognitionId): string {
  return cognitionIdentity(value).display
}
