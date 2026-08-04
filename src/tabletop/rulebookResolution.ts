import { parseCommit } from './commitSelection'
import {
  resolveRound as resolveRoundEngine,
  type BonusAward,
  type BonusNeed,
  type CognitionId,
  type GameState,
  type Resolution,
} from './model'
import { isSpecialAction } from './specialActions'

function activeBeforeResolution(game: GameState): BonusNeed[] {
  return game.bonusNeeds.filter((bonus) => bonus.gifts > 0 && bonus.availableRound <= game.round)
}

function inferImmediateBonus(game: GameState, resolved: GameState, award: BonusAward): BonusNeed | null {
  const specialId = award.bonusId.includes('-SA4-') ? 'SA4' : award.bonusId.endsWith('-SA5') ? 'SA5' : null
  if (!specialId) return null
  const cognitionId = award.bonusId.split('-')[2] as CognitionId | undefined
  const actor = resolved.roundLedger?.specialActions.find((use) => use.card.id === specialId && use.cognitionId === cognitionId)
    ?? resolved.roundLedger?.specialActions.find((use) => use.card.id === specialId)
  if (!actor) return null
  return {
    id: award.bonusId,
    need: award.need,
    gifts: 1,
    initialGifts: 1,
    sourceStrategyId: specialId,
    sourceStrategyTitle: actor.card.title,
    sourceCognitionId: actor.cognitionId,
    sourceCognitionName: actor.cognitionName,
    availableRound: game.round,
  }
}

function bonusOpportunities(game: GameState, resolved: GameState): BonusNeed[] {
  const byId = new Map<string, BonusNeed>()
  activeBeforeResolution(game).forEach((bonus) => byId.set(bonus.id, { ...bonus }))

  resolved.bonusNeeds
    .filter((bonus) => bonus.availableRound <= game.round && (bonus.sourceStrategyId === 'SA4' || bonus.sourceStrategyId === 'SA5'))
    .forEach((bonus) => byId.set(bonus.id, { ...bonus, gifts: bonus.initialGifts }))

  resolved.roundLedger?.bonusAwards.forEach((award) => {
    if (byId.has(award.bonusId)) return
    const inferred = inferImmediateBonus(game, resolved, award)
    if (inferred) byId.set(inferred.id, inferred)
  })

  return [...byId.values()]
}

function eventEffectsActive(game: GameState, resolved: GameState): boolean {
  return game.situation.event || Boolean(resolved.roundLedger?.specialActions.some((use) => use.card.id === 'SA6'))
}

function positiveStrength(game: GameState, resolved: GameState, line: Resolution, need: string): number {
  if (!line.legal || isSpecialAction(line.strategy)) return 0
  const source = eventEffectsActive(game, resolved)
    ? [...line.strategy.effects, ...line.strategy.eventEffects]
    : line.strategy.effects
  let strength = source
    .filter((effect) => effect.need === need && effect.amount > 0)
    .reduce((total, effect) => total + effect.amount, 0)

  if (line.specialAction?.id === 'SA7') {
    const actor = resolved.cognitions.find((cognition) => cognition.id === line.cognitionId)
    const target = parseCommit(actor?.selected).target
    if (target === need && strength > 0) strength += 3
  }
  return strength
}

function awardedByCognition(awards: BonusAward[]): Map<CognitionId, number> {
  const result = new Map<CognitionId, number>()
  awards.forEach((award) => award.cognitionIds.forEach((id) => {
    result.set(id, (result.get(id) ?? 0) + award.pointsEach)
  }))
  return result
}

/**
 * Resolve a round using the existing engine, then apply the physical rulebook's
 * non-competitive Bonus Need rule: every legal story that tends an available
 * Bonus Need receives all gifts shown on that Bonus Need.
 */
export function resolveRound(game: GameState): GameState {
  const resolved = resolveRoundEngine(game)
  const ledger = resolved.roundLedger
  if (!ledger) return resolved

  const opportunities = bonusOpportunities(game, resolved)
  const correctedAwards: BonusAward[] = []
  const completedBonusIds = new Set<string>()
  const cognitionOrder = new Map(game.cognitions.map((cognition, index) => [cognition.id, index]))

  for (const bonus of opportunities) {
    const contenders = resolved.resolution.filter((line) => positiveStrength(game, resolved, line, bonus.need) > 0)
    if (contenders.length === 0) continue
    const unique = contenders
      .filter((line, index, all) => all.findIndex((candidate) => candidate.cognitionId === line.cognitionId) === index)
      .sort((left, right) => (cognitionOrder.get(left.cognitionId) ?? 99) - (cognitionOrder.get(right.cognitionId) ?? 99))
    correctedAwards.push({
      bonusId: bonus.id,
      need: bonus.need,
      cognitionIds: unique.map((line) => line.cognitionId),
      cognitionNames: unique.map((line) => line.cognitionName),
      pointsEach: bonus.gifts,
    })
    completedBonusIds.add(bonus.id)
  }

  const previousScores = awardedByCognition(ledger.bonusAwards)
  const correctedScores = awardedByCognition(correctedAwards)
  const cognitions = resolved.cognitions.map((cognition) => ({
    ...cognition,
    bonusScore: cognition.bonusScore
      - (previousScores.get(cognition.id) ?? 0)
      + (correctedScores.get(cognition.id) ?? 0),
  }))

  return {
    ...resolved,
    cognitions,
    bonusNeeds: resolved.bonusNeeds.filter((bonus) => !completedBonusIds.has(bonus.id)),
    roundLedger: { ...ledger, bonusAwards: correctedAwards },
  }
}
