import type { StrategyCard } from '../data/cards'
import { sharedPersonName } from './gameParticipants'
import type { BonusNeed, GameState, Resolution } from './model'
import { isSpecialAction } from './specialActions'

const strategyActionOverrides: Record<string, string> = {
  ST8: 'notice something they appreciate',
  ST21: 'secure their belongings',
  ST37: 'cuddle a favorite stuffed animal',
  ST38: 'place their hands on opposite sides of their face',
  ST47: 'reflect',
  ST51: 'volunteer or perform an act of kindness',
}

const situationContextOverrides: Record<string, string> = {
  S1: 'while at a busy airport', S2: 'during a family gathering', S3: 'while attending a career fair', S4: 'while at a music festival', S5: 'while studying for exams', S6: 'while at a social gathering', S7: 'during a power outage', S8: 'during a group fitness class', S9: 'while in a hospital waiting room', S10: 'while alone at a park', S11: 'during a business meeting', S12: 'while on a long flight', S13: 'while at a library', S14: 'while in a traffic jam', S15: 'during a team-building activity', S16: 'while on a beach vacation', S17: 'while participating in a sports activity', S18: 'during a meditation retreat', S19: 'while at a charity event', S20: 'while at home during a storm', S21: 'at a dance party',
}

function unique(values: string[]): string[] { return [...new Set(values)] }
function joinNatural(values: string[]): string {
  const items = unique(values)
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
function possessive(name: string): string { return name.endsWith('s') ? `${name}’` : `${name}’s` }
function needObject(values: string[]): string {
  const needs = unique(values)
  return needs.length === 1 ? `its need for ${needs[0]}` : `its needs for ${joinNatural(needs)}`
}
function ownedNeedObject(values: string[]): string {
  const needs = unique(values)
  return needs.length === 1 ? `need for ${needs[0]}` : `needs for ${joinNatural(needs)}`
}

export function strategyActionPhrase(strategy: StrategyCard): string {
  if (isSpecialAction(strategy)) return `use ${strategy.title}`
  const override = strategyActionOverrides[strategy.id]
  if (override) return override
  const cleaned = strategy.title.replace(/[.!?]+$/, '')
  return cleaned ? cleaned[0].toLowerCase() + cleaned.slice(1) : strategy.title
}

export function situationContextPhrase(game: Pick<GameState, 'situation'>): string {
  return situationContextOverrides[game.situation.id] ?? `during “${game.situation.title}”`
}

function positiveNeeds(game: GameState, line: Resolution): Set<string> {
  if (isSpecialAction(line.strategy)) return new Set()
  const eventActive = game.situation.event || game.roundLedger?.specialActions.some((use) => use.card.id === 'SA6')
  const effects = eventActive ? [...line.strategy.effects, ...line.strategy.eventEffects] : line.strategy.effects
  return new Set(effects.filter((effect) => effect.amount > 0).map((effect) => effect.need))
}

function publicRows(game: GameState) {
  if (game.roundLedger) return game.roundLedger.publicChanges
  return game.cognitions.flatMap((cognition) => cognition.publicNeeds.map((slot) => ({ key: `${cognition.id}:${slot.card.id}`, cognitionId: cognition.id, cognitionName: cognition.name, need: slot.card.need, feeling: slot.card.feeling, before: slot.gifts, after: slot.gifts, removed: 0, setup: slot.setup })))
}

export function nvcStory(game: GameState, line: Resolution): string {
  const specialOpening = line.specialSummary ? `${line.specialSummary} ` : ''
  if (isSpecialAction(line.strategy)) {
    return `${specialOpening || `${line.cognitionName} used the Special Action “${line.strategy.title}.” `}No ordinary Strategy was paired with it this round.`.trim()
  }

  if (!line.legal) {
    return `${specialOpening}${line.cognitionName}’s paired Strategy, “${line.strategy.title},” still did not match one of its unresolved Public Needs, a qualifying Private Need opened by the Special Action, or an active Bonus Need, so the Strategy was discarded.`
  }

  const person = sharedPersonName(game)
  const matchingNeeds = positiveNeeds(game, line)
  const rows = publicRows(game)
  const ownPublic = unique(rows.filter((row) => row.cognitionId === line.cognitionId && row.before > 0 && matchingNeeds.has(row.need)).map((row) => row.need))
  const motivatingBonusNeeds = ownPublic.length === 0 ? unique(line.bonusMatches) : []
  const motive = ownPublic.length > 0
    ? needObject(ownPublic)
    : motivatingBonusNeeds.length === 1 ? `the active Bonus Need for ${motivatingBonusNeeds[0]}`
      : motivatingBonusNeeds.length > 1 ? `the active Bonus Needs for ${joinNatural(motivatingBonusNeeds)}`
        : line.privateMatches.length > 0 && (line.specialAction?.id === 'SA2' || line.specialAction?.id === 'SA3')
          ? 'a hidden Private Need that the Special Action allowed to guide the choice'
          : 'a need represented by this Strategy'
  const motiveReference = ownPublic.length + motivatingBonusNeeds.length === 1 ? 'that need' : 'those needs'

  const sentences = [
    specialOpening.trim(),
    `${line.cognitionName} was motivated by ${motive}.`,
    `Through ${possessive(line.cognitionName)} influence, ${person} chose to ${strategyActionPhrase(line.strategy)} ${situationContextPhrase(game)} in an attempt to meet ${motiveReference}.`,
  ].filter(Boolean)

  const otherPublic = new Map<string, string[]>()
  rows.forEach((row) => {
    if (row.cognitionId === line.cognitionId || row.before === 0 || !matchingNeeds.has(row.need)) return
    otherPublic.set(row.cognitionName, unique([...(otherPublic.get(row.cognitionName) ?? []), row.need]))
  })
  otherPublic.forEach((needs, cognitionName) => sentences.push(`That action also tended ${possessive(cognitionName)} ${ownedNeedObject(needs)}.`))

  const privateOwners = game.cognitions.filter((cognition) => line.privateMatches.includes(cognition.privateNeed.card.need))
  if (privateOwners.length > 0) sentences.push(`It also quietly tended ${privateOwners.length === 1 ? 'a hidden Private Need' : 'hidden Private Needs'} held by ${joinNatural(privateOwners.map((cognition) => cognition.name))}.`)

  const incidentalBonuses = unique(line.bonusMatches.filter((need) => !motivatingBonusNeeds.includes(need)))
  if (incidentalBonuses.length > 0) sentences.push(`It also tended ${incidentalBonuses.length === 1 ? 'the active Bonus Need' : 'active Bonus Needs'} for ${joinNatural(incidentalBonuses)}.`)
  if (line.bonusCreated.length > 0) sentences.push(`That same action also introduced ${line.bonusCreated.length === 1 ? 'a new Bonus Need' : 'new Bonus Needs'} for ${joinNatural(line.bonusCreated.map((bonus) => bonus.need))}, which will enter play next round.`)

  return sentences.join(' ')
}

export function bonusOriginPhrase(bonus: BonusNeed): string {
  return `introduced by “${bonus.sourceStrategyTitle},” an action influenced by ${possessive(bonus.sourceCognitionName)} needs`
}
