import type { StrategyCard } from '../data/cards'
import type { BonusNeed, Cognition, CognitionId, GameState } from './model'
import { eventEffectsActive } from './timedSpecialActions'

export type PublicMatch = {
  cognitionId: CognitionId
  cognitionName: string
  feeling: string
  need: string
  gifts: number
  remaining: number
  strength: number
  eventStrength: number
  own: boolean
}

export type BonusMatch = BonusNeed & {
  contribution: number
  strength: number
  eventStrength: number
}

export type CreatedBonusEffect = {
  need: string
  gifts: number
  eventGifts: number
}

export type StrategyAnalysis = {
  card: StrategyCard
  playable: boolean
  ownPublic: PublicMatch[]
  otherPublic: PublicMatch[]
  bonusNeeds: BonusMatch[]
  createdBonuses: CreatedBonusEffect[]
  tendsOwnPrivate: boolean
  privatePotential: number
  groupPotential: number
  score: number
  playableBy: Array<{ cognitionId: CognitionId; cognitionName: string; needs: string[] }>
}

export type TradeProposal = {
  id: string
  npcId: CognitionId
  npcName: string
  playerGives: StrategyCard
  npcGives: StrategyCard
  playerReceives: StrategyAnalysis
  npcReceives: StrategyAnalysis
  playerKeeps: StrategyAnalysis
  npcKeeps: StrategyAnalysis
  playerGain: number
  npcGain: number
  mutualUpgrade: boolean
}

function effectStrength(game: GameState, card: StrategyCard, need: string): { strength: number; eventStrength: number } {
  const standard = card.effects
    .filter((effect) => effect.need === need && effect.amount > 0)
    .reduce((total, effect) => total + effect.amount, 0)
  const eventStrength = eventEffectsActive(game)
    ? card.eventEffects
      .filter((effect) => effect.need === need && effect.amount > 0)
      .reduce((total, effect) => total + effect.amount, 0)
    : 0
  return { strength: standard + eventStrength, eventStrength }
}

function strengthFor(game: GameState, card: StrategyCard, need: string): number {
  return effectStrength(game, card, need).strength
}

function createdBonusEffects(game: GameState, card: StrategyCard): CreatedBonusEffect[] {
  const grouped = new Map<string, CreatedBonusEffect>()
  const add = (need: string, amount: number, event: boolean) => {
    if (amount >= 0) return
    const gifts = Math.abs(amount)
    const current = grouped.get(need) ?? { need, gifts: 0, eventGifts: 0 }
    current.gifts += gifts
    if (event) current.eventGifts += gifts
    grouped.set(need, current)
  }

  card.effects.forEach((effect) => add(effect.need, effect.amount, false))
  if (eventEffectsActive(game)) card.eventEffects.forEach((effect) => add(effect.need, effect.amount, true))
  return [...grouped.values()]
}

function activeBonuses(game: GameState): BonusNeed[] {
  return game.bonusNeeds.filter((bonus) => bonus.gifts > 0 && bonus.availableRound <= game.round)
}

function publicMatches(game: GameState, card: StrategyCard): PublicMatch[] {
  return game.cognitions.flatMap((cognition) => cognition.publicNeeds.flatMap((slot) => {
    const { strength, eventStrength } = effectStrength(game, card, slot.card.need)
    if (slot.gifts <= 0 || strength <= 0) return []
    return [{
      cognitionId: cognition.id,
      cognitionName: cognition.name,
      feeling: slot.card.feeling,
      need: slot.card.need,
      gifts: Math.min(slot.gifts, strength),
      remaining: slot.gifts,
      strength,
      eventStrength,
      own: false,
    }]
  }))
}

export function analyzeStrategy(game: GameState, cognition: Cognition, card: StrategyCard): StrategyAnalysis {
  const matches = publicMatches(game, card).map((match) => ({ ...match, own: match.cognitionId === cognition.id }))
  const ownPublic = matches.filter((match) => match.own)
  const otherPublic = matches.filter((match) => !match.own)
  const bonuses: BonusMatch[] = activeBonuses(game).flatMap((bonus) => {
    const { strength, eventStrength } = effectStrength(game, card, bonus.need)
    if (strength <= 0) return []
    return [{ ...bonus, contribution: Math.min(bonus.gifts, strength), strength, eventStrength }]
  })
  const privateStrength = strengthFor(game, card, cognition.privateNeed.card.need)
  const privatePotential = cognition.privateNeed.gifts > 0 ? Math.min(cognition.privateNeed.gifts, privateStrength) : 0
  const visiblePrivatePotential = cognition.human && !cognition.privateVisible ? 0 : privatePotential
  const groupPotential = matches.reduce((total, match) => total + match.gifts, 0)
  const bonusPotential = bonuses.reduce((total, bonus) => total + bonus.contribution, 0)
  const ownPotential = ownPublic.reduce((total, match) => total + match.gifts, 0)
  const playable = ownPublic.length > 0 || bonuses.length > 0

  const playableBy = game.cognitions.flatMap((target) => {
    const needs = target.publicNeeds
      .filter((slot) => slot.gifts > 0 && strengthFor(game, card, slot.card.need) > 0)
      .map((slot) => slot.card.need)
    return needs.length > 0 ? [{ cognitionId: target.id, cognitionName: target.name, needs: [...new Set(needs)] }] : []
  })

  const score = playable
    ? ownPotential * 4.5 + groupPotential * 1.35 + bonusPotential * 3 + visiblePrivatePotential * 3.5
    : 0

  return {
    card,
    playable,
    ownPublic,
    otherPublic,
    bonusNeeds: bonuses,
    createdBonuses: createdBonusEffects(game, card),
    tendsOwnPrivate: privatePotential > 0,
    privatePotential,
    groupPotential,
    score,
    playableBy,
  }
}

function acceptableExchange(receives: StrategyAnalysis, keeps: StrategyAnalysis): boolean {
  if (!receives.playable) return false
  if (!keeps.playable) return true
  return receives.score >= keeps.score * 0.72 || receives.score >= keeps.score - 1.25
}

export function generateTradeProposals(game: GameState): TradeProposal[] {
  if (game.phase !== 'planning') return []
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player) return []

  const proposals: TradeProposal[] = []
  for (const npc of game.cognitions.filter((cognition) => !cognition.human)) {
    for (const playerCard of player.hand) {
      const playerKeeps = analyzeStrategy(game, player, playerCard)
      const npcReceives = analyzeStrategy(game, npc, playerCard)
      if (!npcReceives.playable) continue

      for (const npcCard of npc.hand) {
        const npcKeeps = analyzeStrategy(game, npc, npcCard)
        const playerReceives = analyzeStrategy(game, player, npcCard)
        if (!playerReceives.playable) continue
        if (!acceptableExchange(playerReceives, playerKeeps) || !acceptableExchange(npcReceives, npcKeeps)) continue

        const playerGain = playerReceives.score - playerKeeps.score
        const npcGain = npcReceives.score - npcKeeps.score
        proposals.push({
          id: `${npc.id}:${playerCard.id}:${npcCard.id}`,
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

  return proposals
    .sort((left, right) => {
      const leftMutual = left.mutualUpgrade ? 8 : 0
      const rightMutual = right.mutualUpgrade ? 8 : 0
      const leftPrivate = player.privateVisible && left.playerReceives.tendsOwnPrivate ? 4 : 0
      const rightPrivate = player.privateVisible && right.playerReceives.tendsOwnPrivate ? 4 : 0
      const leftValue = leftMutual + leftPrivate + left.playerReceives.score + left.npcReceives.score + Math.min(left.playerGain, left.npcGain)
      const rightValue = rightMutual + rightPrivate + right.playerReceives.score + right.npcReceives.score + Math.min(right.playerGain, right.npcGain)
      return rightValue - leftValue
    })
    .filter((proposal, index, all) => all.findIndex((candidate) => candidate.npcId === proposal.npcId && candidate.playerGives.id === proposal.playerGives.id) === index)
    .slice(0, 4)
}

export function applyTrade(game: GameState, proposal: TradeProposal): GameState {
  const player = game.cognitions.find((cognition) => cognition.human)
  if (!player || game.phase !== 'planning') return game

  return {
    ...game,
    cognitions: game.cognitions.map((cognition) => {
      if (cognition.id === player.id) {
        return {
          ...cognition,
          selected: null,
          hand: cognition.hand.map((card) => card.id === proposal.playerGives.id ? proposal.npcGives : card),
        }
      }
      if (cognition.id === proposal.npcId) {
        return {
          ...cognition,
          selected: null,
          hand: cognition.hand.map((card) => card.id === proposal.npcGives.id ? proposal.playerGives : card),
        }
      }
      return cognition
    }),
  }
}
