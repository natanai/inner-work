import type { GameState } from './model'

export type CardKind = 'strategy' | 'need' | 'situation'

const BASE_URL = import.meta.env.BASE_URL

export function cardFrontUrl(kind: CardKind, id: string): string {
  return `${BASE_URL}cards/${kind}/${id}.webp`
}

export function cardBackUrl(kind: CardKind): string {
  const file = kind === 'strategy'
    ? 'strategy-back.webp'
    : kind === 'need'
      ? 'need-back.webp'
      : 'situation-back.webp'
  return `${BASE_URL}cards/backs/${file}`
}

export function gameAssetUrls(game: GameState): string[] {
  const urls = new Set<string>([
    cardBackUrl('strategy'),
    cardBackUrl('need'),
    cardBackUrl('situation'),
    cardFrontUrl('situation', game.situation.id),
  ])

  for (const cognition of game.cognitions) {
    for (const slot of cognition.publicNeeds) {
      urls.add(cardFrontUrl('need', slot.card.id))
    }
    for (const strategy of cognition.hand) {
      urls.add(cardFrontUrl('strategy', strategy.id))
    }
  }

  const alpha = game.cognitions[0]
  if (alpha) urls.add(cardFrontUrl('need', alpha.privateNeed.card.id))

  for (const line of game.resolution) {
    urls.add(cardFrontUrl('strategy', line.strategy.id))
  }

  return [...urls]
}

function loadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Unable to load ${url}`))
    image.src = url
  })
}

export async function preloadGameAssets(
  game: GameState,
  onProgress: (completed: number, total: number) => void,
): Promise<void> {
  const urls = gameAssetUrls(game)
  let cursor = 0
  let completed = 0
  onProgress(0, urls.length)

  async function worker() {
    while (cursor < urls.length) {
      const index = cursor
      cursor += 1
      await loadImage(urls[index])
      completed += 1
      onProgress(completed, urls.length)
    }
  }

  const workerCount = Math.min(6, urls.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}
