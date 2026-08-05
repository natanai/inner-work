import type { GameState } from './model'
import { registerCognitionNames } from './cognitionIdentity'

/**
 * Neutral Greek names give each Cognition a memorable identity without
 * implying that it represents one fixed psychological faculty or brain area.
 * Every entry begins with a distinct letter so full names remain easy to scan.
 */
export const COGNITION_NAME_CATALOG = [
  'Alpha',
  'Beta',
  'Gamma',
  'Delta',
  'Epsilon',
  'Zeta',
  'Theta',
  'Kappa',
  'Lambda',
  'Mu',
  'Sigma',
  'Omega',
  'Psi',
] as const

function shuffle<T>(source: readonly T[]): T[] {
  const result = [...source]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

/** Assign three distinct names once, when a new game begins. */
export function assignRandomCognitionNames(game: GameState): GameState {
  const names = shuffle(COGNITION_NAME_CATALOG).slice(0, game.cognitions.length)
  const namedGame: GameState = {
    ...game,
    cognitions: game.cognitions.map((cognition, index) => ({
      ...cognition,
      name: names[index] ?? `Cognition ${index + 1}`,
    })),
  }
  registerCognitionNames(namedGame.cognitions)
  return namedGame
}
