#!/usr/bin/env node

/**
 * Inner Work choice-floor audit
 *
 * This intentionally runs without build dependencies so it can be executed with:
 *
 *   node scripts/choice-audit.mjs --trials 50000 --seed 20260803
 *
 * It reads the canonical card rows from src/data/cards.ts rather than maintaining a
 * second copy of the deck. The audit measures ordinary legal cards and one-for-one
 * trade paths. Special Actions are reported separately until their acquisition and
 * timing rules are fully specified.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const cardsSource = fs.readFileSync(path.join(root, 'src/data/cards.ts'), 'utf8')

function parseRows(name) {
  const match = cardsSource.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]) as const`))
  if (!match) throw new Error(`Could not locate ${name} in src/data/cards.ts`)
  return JSON.parse(match[1])
}

const needRows = parseRows('needRows')
const situationRows = parseRows('situationRows')
const strategyRows = parseRows('strategyRows')
const specialRows = parseRows('specialRows')

const args = process.argv.slice(2)
function argument(name, fallback) {
  const index = args.indexOf(name)
  if (index < 0 || index + 1 >= args.length) return fallback
  return Number(args[index + 1])
}

const trials = Math.max(100, Math.floor(argument('--trials', 50000)))
const seed = Math.floor(argument('--seed', 20260803)) >>> 0
const jsonOnly = args.includes('--json')

function mulberry32(initial) {
  let value = initial >>> 0
  return () => {
    value += 0x6D2B79F5
    let result = value
    result = Math.imul(result ^ result >>> 15, result | 1)
    result ^= result + Math.imul(result ^ result >>> 7, result | 61)
    return ((result ^ result >>> 14) >>> 0) / 4294967296
  }
}

const random = mulberry32(seed)

function shuffle(source) {
  const result = [...source]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

const needs = needRows.map(([id, feeling, need]) => ({ id, feeling, need }))
const situations = situationRows.map(([id, title, effects, event, feelingMultiplier]) => ({
  id,
  title,
  effects: effects.map(([need, amount]) => ({ need, amount })),
  event,
  feelingMultiplier,
}))
const strategies = strategyRows.map(([id, title, effects, eventEffects]) => ({
  id,
  title,
  effects: effects.map(([need, amount]) => ({ need, amount })),
  eventEffects: eventEffects.map(([need, amount]) => ({ need, amount })),
}))

function positiveNeeds(strategy, situation, includeEventEffects) {
  const effects = includeEventEffects && situation.event
    ? [...strategy.effects, ...strategy.eventEffects]
    : strategy.effects
  return new Set(effects.filter((effect) => effect.amount > 0).map((effect) => effect.need))
}

function publicNeedNames(threeNeeds, privateIndex) {
  return new Set(threeNeeds.filter((_, index) => index !== privateIndex).map((card) => card.need))
}

function legalCards(hand, publicNeeds, situation, includeEventEffects) {
  return hand.filter((card) => {
    const effects = positiveNeeds(card, situation, includeEventEffects)
    return [...publicNeeds].some((need) => effects.has(need))
  })
}

function bestPrivateIndex(threeNeeds, hand, situation, includeEventEffects) {
  const ranked = threeNeeds.map((_, privateIndex) => ({
    privateIndex,
    legal: legalCards(hand, publicNeedNames(threeNeeds, privateIndex), situation, includeEventEffects).length,
  }))
  const best = Math.max(...ranked.map((entry) => entry.legal))
  const choices = ranked.filter((entry) => entry.legal === best)
  return choices[Math.floor(random() * choices.length)].privateIndex
}

function tradePaths(player, npcs, situation, includeEventEffects) {
  const pairs = []
  const received = new Set()
  for (const npc of npcs) {
    for (const receive of npc.hand) {
      if (legalCards([receive], player.publicNeeds, situation, includeEventEffects).length === 0) continue
      for (const give of player.hand) {
        if (legalCards([give], npc.publicNeeds, situation, includeEventEffects).length === 0) continue
        pairs.push({ npc: npc.id, give: give.id, receive: receive.id })
        received.add(`${npc.id}:${receive.id}`)
      }
    }
  }
  return { pairCount: pairs.length, distinctOffers: received.size }
}

function emptyHistogram(maximum) {
  return Array.from({ length: maximum + 1 }, () => 0)
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`
}

function summarizeMode(includeEventEffects) {
  const legalHistogram = emptyHistogram(4)
  const pathHistogram = new Map()
  let zeroTradePairs = 0
  let zeroOrOneLegal = 0
  let zeroOrOneTotalPaths = 0
  let totalLegal = 0
  let totalDistinctTradeOffers = 0
  let totalTradePairs = 0
  let privateChoiceImproved = 0
  let privateChoiceCouldNotHelp = 0
  const narrowStreakHistogram = new Map()

  for (let trial = 0; trial < trials; trial += 1) {
    const situation = situations[Math.floor(random() * situations.length)]
    const needDeck = shuffle(needs)
    const strategyDeck = shuffle(strategies)

    const cognitionNeeds = [needDeck.slice(0, 3), needDeck.slice(3, 6), needDeck.slice(6, 9)]
    const cognitionHands = [strategyDeck.slice(0, 4), strategyDeck.slice(4, 8), strategyDeck.slice(8, 12)]

    const randomPrivate = Math.floor(random() * 3)
    const randomLegal = legalCards(
      cognitionHands[0],
      publicNeedNames(cognitionNeeds[0], randomPrivate),
      situation,
      includeEventEffects,
    ).length
    const playerPrivate = bestPrivateIndex(cognitionNeeds[0], cognitionHands[0], situation, includeEventEffects)
    const player = {
      id: 'alpha',
      hand: cognitionHands[0],
      publicNeeds: publicNeedNames(cognitionNeeds[0], playerPrivate),
    }
    const npcs = [1, 2].map((index) => {
      const privateIndex = bestPrivateIndex(cognitionNeeds[index], cognitionHands[index], situation, includeEventEffects)
      return {
        id: index === 1 ? 'beta' : 'gamma',
        hand: cognitionHands[index],
        publicNeeds: publicNeedNames(cognitionNeeds[index], privateIndex),
      }
    })

    const legal = legalCards(player.hand, player.publicNeeds, situation, includeEventEffects).length
    const trades = tradePaths(player, npcs, situation, includeEventEffects)
    const totalPaths = legal + trades.distinctOffers

    legalHistogram[legal] += 1
    pathHistogram.set(totalPaths, (pathHistogram.get(totalPaths) ?? 0) + 1)
    totalLegal += legal
    totalDistinctTradeOffers += trades.distinctOffers
    totalTradePairs += trades.pairCount
    if (trades.pairCount === 0) zeroTradePairs += 1
    if (legal <= 1) zeroOrOneLegal += 1
    if (totalPaths <= 1) zeroOrOneTotalPaths += 1
    if (legal > randomLegal) privateChoiceImproved += 1
    if (legal <= 1) privateChoiceCouldNotHelp += 1

    // Isolate hand persistence: keep the same two Public Need targets and cycle only
    // the one card selected/discarded each round, matching the current refill pattern.
    let hand = [...player.hand]
    let deckIndex = 12
    let currentNarrow = 0
    let longestNarrow = 0
    for (let round = 0; round < 8; round += 1) {
      const legalNow = legalCards(hand, player.publicNeeds, situation, includeEventEffects)
      if (legalNow.length <= 1) {
        currentNarrow += 1
        longestNarrow = Math.max(longestNarrow, currentNarrow)
      } else {
        currentNarrow = 0
      }
      const leaving = legalNow.length > 0
        ? legalNow[Math.floor(random() * legalNow.length)]
        : hand[Math.floor(random() * hand.length)]
      hand = hand.filter((card) => card.id !== leaving.id)
      hand.push(strategyDeck[deckIndex % strategyDeck.length])
      deckIndex += 1
    }
    narrowStreakHistogram.set(longestNarrow, (narrowStreakHistogram.get(longestNarrow) ?? 0) + 1)
  }

  return {
    includeEventEffects,
    legalHistogram,
    averageLegalCards: totalLegal / trials,
    averageDistinctTradeOffers: totalDistinctTradeOffers / trials,
    averageTradePairs: totalTradePairs / trials,
    noTradePairRate: zeroTradePairs / trials,
    zeroOrOneLegalRate: zeroOrOneLegal / trials,
    zeroOrOneTotalPathRate: zeroOrOneTotalPaths / trials,
    privateChoiceImprovementRate: privateChoiceImproved / trials,
    privateChoiceStillNarrowRate: privateChoiceCouldNotHelp / trials,
    totalPathHistogram: [...pathHistogram.entries()].sort((left, right) => left[0] - right[0]),
    narrowStreakHistogram: [...narrowStreakHistogram.entries()].sort((left, right) => left[0] - right[0]),
  }
}

const currentEngine = summarizeMode(false)
const physicalEventInterpretation = summarizeMode(true)

const report = {
  generatedAt: new Date().toISOString(),
  seed,
  trials,
  cards: {
    needs: needs.length,
    situations: situations.length,
    strategies: strategies.length,
    specialActionsDocumentedButNotActive: specialRows.length,
  },
  assumptions: [
    'The player chooses the Private Need that maximizes immediate ordinary Strategy legality; ties are random.',
    'Active Bonus Needs are omitted from the initial-deal baseline because none exist yet.',
    'A directed trade path is a one-for-one pair where the received card is legal for the player and the offered card is legal for the NPC.',
    'Private Need matches are never counted as legal paths.',
    'The persistence test holds Public Need targets constant for eight cycles to isolate the current one-card refill behavior.',
    'Special Actions and unimplemented Magnifying Glass actions are reported as missing choices rather than simulated choices.',
  ],
  modes: {
    currentEngine,
    eventEffectsEnabledOnEventSituations: physicalEventInterpretation,
  },
}

if (jsonOnly) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  process.exit(0)
}

function markdownMode(title, mode) {
  const legalRows = mode.legalHistogram.map((count, legal) => `| ${legal} | ${count} | ${percent(count / trials)} |`).join('\n')
  const streakRows = mode.narrowStreakHistogram.map(([length, count]) => `| ${length} rounds | ${count} | ${percent(count / trials)} |`).join('\n')
  return `## ${title}\n\n| Ordinary legal cards | Trials | Share |\n|---:|---:|---:|\n${legalRows}\n\n- Average ordinary legal cards: **${mode.averageLegalCards.toFixed(3)}**\n- Turns with zero or one ordinary legal card: **${percent(mode.zeroOrOneLegalRate)}**\n- Average distinct NPC cards available through a viable one-for-one trade: **${mode.averageDistinctTradeOffers.toFixed(3)}**\n- Turns with no viable one-for-one trade pair: **${percent(mode.noTradePairRate)}**\n- Turns with zero or one total play/trade route: **${percent(mode.zeroOrOneTotalPathRate)}**\n- Choosing the Private Need strategically improved immediate legality over a random choice in **${percent(mode.privateChoiceImprovementRate)}** of deals.\n- Even after the best immediate Private choice, the hand still had zero or one legal card in **${percent(mode.privateChoiceStillNarrowRate)}** of deals.\n\n### Longest narrow-hand streak in an eight-cycle persistence test\n\n| Longest streak | Trials | Share |\n|---:|---:|---:|\n${streakRows}`
}

const markdown = `# Inner Work choice-floor audit\n\nGenerated from the canonical card rows with **${trials.toLocaleString()} trials** and seed **${seed}**.\n\n${markdownMode('Current engine legality', currentEngine)}\n\n${markdownMode('Event effects included during Event Situations', physicalEventInterpretation)}\n\n## Interpretation boundaries\n\n${report.assumptions.map((assumption) => `- ${assumption}`).join('\n')}\n\nThe purpose of this audit is not to choose a new rule automatically. It establishes a repeatable baseline so rulebook-parity changes, Special Actions, and player-directed negotiation can be measured before considering a new solo safety valve.\n`

process.stdout.write(markdown)
