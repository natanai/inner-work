import type { Cognition, GameState } from './model'
import { analyzeStrategy, type TradeProposal } from './trading'

export type DirectedTradeOption = TradeProposal & {
  requestedNeed: string
  requestedKind: 'public' | 'bonus'
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function targetNeeds(game: GameState, player: Cognition): Array<{ need: string; kind: 'public' | 'bonus' }> {
  const publicNeeds = player.publicNeeds
    .filter((slot) => slot.gifts > 0)
    .map((slot) => ({ need: slot.card.need, kind: 'public' as const }))
  const bonuses = game.bonusNeeds
    .filter((bonus) => bonus.gifts > 0 && bonus.availableRound <= game.round)
    .map((bonus) => ({ need: bonus.need, kind: 'bonus' as const }))
  return unique([...publicNeeds, ...bonuses].map((item) => `${item.kind}:${item.need}`))
    .map((key) => {
      const [kind, ...need] = key.split(':')
      return { kind: kind as 'public' | 'bonus', need: need.join(':') }
    })
}

function npcAccepts(receivesScore: number, keepsScore: number, receivesPlayable: boolean, keepsPlayable: boolean): boolean {
  if (!receivesPlayable) return false
  if (!keepsPlayable) return true
  return receivesScore >= keepsScore * .72 || receivesScore >= keepsScore - 1.25
}

export function generateDirectedTradeOptions(game: GameState): DirectedTradeOption[] {
  if (game.phase !== 'planning') return []
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player) return []

  const options: DirectedTradeOption[] = []
  for (const target of targetNeeds(game, player)) {
    for (const npc of game.cognitions.filter((cognition) => !cognition.human)) {
      for (const npcCard of npc.hand) {
        const playerReceives = analyzeStrategy(game, player, npcCard)
        const reachesTarget = target.kind === 'public'
          ? playerReceives.ownPublic.some((match) => match.need === target.need)
          : playerReceives.bonusNeeds.some((bonus) => bonus.need === target.need)
        if (!reachesTarget) continue

        const npcKeeps = analyzeStrategy(game, npc, npcCard)
        for (const playerCard of player.hand) {
          const playerKeeps = analyzeStrategy(game, player, playerCard)
          const npcReceives = analyzeStrategy(game, npc, playerCard)
          if (!npcAccepts(npcReceives.score, npcKeeps.score, npcReceives.playable, npcKeeps.playable)) continue

          const playerGain = playerReceives.score - playerKeeps.score
          const npcGain = npcReceives.score - npcKeeps.score
          options.push({
            id: `request:${target.kind}:${target.need}:${npc.id}:${playerCard.id}:${npcCard.id}`,
            requestedNeed: target.need,
            requestedKind: target.kind,
            npcId: npc.id,
            npcName: npc.name,
            playerGives: playerCard,
            npcGives: npcCard,
            playerReceives,
            npcReceives,
            playerKeeps,
            npcKeeps,
            playerGain,
            npcGain,
            mutualUpgrade: playerGain > .2 && npcGain > .2,
          })
        }
      }
    }
  }

  return options
    .sort((left, right) => {
      const leftValue = left.playerReceives.score + left.npcReceives.score + (left.mutualUpgrade ? 6 : 0)
      const rightValue = right.playerReceives.score + right.npcReceives.score + (right.mutualUpgrade ? 6 : 0)
      return rightValue - leftValue
    })
    .filter((option, index, all) => all.findIndex((candidate) =>
      candidate.requestedNeed === option.requestedNeed
      && candidate.npcId === option.npcId
      && candidate.npcGives.id === option.npcGives.id
      && candidate.playerGives.id === option.playerGives.id
    ) === index)
}

export function distinctDirectedTradePaths(game: GameState): number {
  return new Set(generateDirectedTradeOptions(game).map((option) => `${option.requestedKind}:${option.requestedNeed}:${option.npcId}:${option.npcGives.id}`)).size
}
