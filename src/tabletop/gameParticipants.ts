import type { GameState } from './model'

export type GameWithSharedPerson = GameState & {
  sharedPersonName?: string
}

/** Normalize a player-entered name before it becomes part of the story. */
export function normalizeSharedPersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 40)
}

/** Store the shared person's name on the game object so every later state spread preserves it. */
export function withSharedPersonName(game: GameState, value: string): GameState {
  const name = normalizeSharedPersonName(value)
  if (!name) return game
  return { ...game, sharedPersonName: name } as GameWithSharedPerson
}

/** The only accessor UI and narrative code should use for the person being influenced. */
export function sharedPersonName(game: Pick<GameState, never> | GameState): string {
  const value = (game as GameWithSharedPerson).sharedPersonName
  return normalizeSharedPersonName(value ?? '') || 'the shared person'
}

export function sharedPersonPossessive(game: GameState): string {
  const name = sharedPersonName(game)
  return name.endsWith('s') ? `${name}’` : `${name}’s`
}
