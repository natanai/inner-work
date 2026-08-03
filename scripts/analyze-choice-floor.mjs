import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/data/cards.ts', import.meta.url), 'utf8')

function literal(name) {
  const match = source.match(new RegExp(`const ${name} = (\\[.*?\\]) as const`, 's'))
  if (!match) throw new Error(`Could not read ${name} from src/data/cards.ts`)
  return Function(`"use strict"; return (${match[1]})`)()
}

const needRows = literal('needRows')
const situationRows = literal('situationRows')
const strategyRows = literal('strategyRows')
const specialRows = literal('specialRows')

const needs = needRows.map(([id, feeling, need]) => ({ id, feeling, need }))
const situations = situationRows.map(([id, title, effects, event, multiplier]) => ({ id, title, effects, event, multiplier }))
const strategies = strategyRows.map(([id, title, effects, eventEffects]) => ({ id, title, effects, eventEffects, special: false }))
const specials = specialRows.map(([id, title]) => ({ id, title, effects: [], eventEffects: [], special: true }))

function rngFrom(seed) {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

function shuffle(items, rng) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

function strength(card, need, event) {
  if (card.special) return 0
  const effects = event ? [...card.effects, ...card.eventEffects] : card.effects
  return effects.filter(([name, amount]) => name === need && amount > 0).reduce((sum, [, amount]) => sum + amount, 0)
}

function legal(card, publicNeeds, situation) {
  if (card.special) return false
  return publicNeeds.some((need) => strength(card, need.need, situation.event) > 0)
}

function directedTrades(playerHand, npcHands, publicByCognition, situation) {
  const paths = new Set()
  for (let npcIndex = 0; npcIndex < npcHands.length; npcIndex += 1) {
    const npcNeeds = publicByCognition[npcIndex + 1]
    for (const offered of npcHands[npcIndex]) {
      if (!legal(offered, publicByCognition[0], situation)) continue
      for (const payment of playerHand) {
        if (!legal(payment, npcNeeds, situation)) continue
        for (const target of publicByCognition[0]) {
          if (strength(offered, target.need, situation.event) > 0) {
            paths.add(`${npcIndex}:${offered.id}:${target.need}`)
          }
        }
      }
    }
  }
  return paths.size
}

function bucket(value) {
  return value >= 4 ? '4+' : String(value)
}

function increment(map, key) {
  map[key] = (map[key] ?? 0) + 1
}

function simulate({ trials, rounds, seed, includeSpecials }) {
  const rng = rngFrom(seed)
  const legalDistribution = {}
  const pathDistribution = {}
  const specialDistribution = {}
  const narrowStreaks = {}
  const needLegalCounts = Object.fromEntries([...new Set(needs.map((need) => need.need))].map((need) => [need, { seen: 0, playable: 0 }]))

  for (let trial = 0; trial < trials; trial += 1) {
    const situation = situations[Math.floor(rng() * situations.length)]
    const needDeck = shuffle(needs, rng)
    const publicByCognition = [0, 1, 2].map((index) => needDeck.slice(index * 2, index * 2 + 2))
    const fullDeck = shuffle(includeSpecials ? [...strategies, ...specials] : strategies, rng)
    let cursor = 0
    let hands = [0, 1, 2].map(() => {
      const hand = fullDeck.slice(cursor, cursor + 4)
      cursor += 4
      return hand
    })

    const playerLegal = hands[0].filter((card) => legal(card, publicByCognition[0], situation)).length
    const specialPaths = hands[0].filter((card) => card.special).length
    const trades = directedTrades(hands[0], hands.slice(1), publicByCognition, situation)
    const magnifierPaths = 4
    increment(legalDistribution, bucket(playerLegal))
    increment(specialDistribution, bucket(specialPaths))
    increment(pathDistribution, bucket(playerLegal + specialPaths + trades + magnifierPaths))

    for (const need of publicByCognition[0]) {
      needLegalCounts[need.need].seen += 1
      if (hands[0].some((card) => legal(card, [need], situation))) needLegalCounts[need.need].playable += 1
    }

    let currentStreak = 0
    let longestStreak = 0
    for (let round = 0; round < rounds; round += 1) {
      const legalCards = hands[0].filter((card) => legal(card, publicByCognition[0], situation))
      if (legalCards.length <= 1) {
        currentStreak += 1
        longestStreak = Math.max(longestStreak, currentStreak)
      } else {
        currentStreak = 0
      }

      const chosen = legalCards[Math.floor(rng() * legalCards.length)] ?? hands[0][Math.floor(rng() * hands[0].length)]
      hands[0] = hands[0].filter((card) => card.id !== chosen?.id)
      while (hands[0].length < 4) {
        if (cursor >= fullDeck.length) cursor = 0
        const candidate = fullDeck[cursor++]
        if (candidate && !hands.flat().some((card) => card.id === candidate.id)) hands[0].push(candidate)
      }
    }
    increment(narrowStreaks, bucket(longestStreak))
  }

  const percent = (count) => `${((count / trials) * 100).toFixed(1)}%`
  const normalize = (distribution) => Object.fromEntries(['0', '1', '2', '3', '4+'].map((key) => [key, percent(distribution[key] ?? 0)]))
  const coverage = Object.entries(needLegalCounts)
    .map(([need, value]) => ({ need, rate: value.seen ? value.playable / value.seen : 0 }))
    .sort((left, right) => left.rate - right.rate)

  return {
    trials,
    roundsPerPersistentHandTest: rounds,
    legalStrategies: normalize(legalDistribution),
    specialActionsInHand: normalize(specialDistribution),
    totalVisiblePathsIncludingTradesAndMagnifier: normalize(pathDistribution),
    longestConsecutiveRoundsWithAtMostOneLegalStrategy: normalize(narrowStreaks),
    lowestNeedCoverage: coverage.slice(0, 8).map(({ need, rate }) => ({ need, playableHandRate: `${(rate * 100).toFixed(1)}%` })),
  }
}

const trials = Number(process.env.TRIALS ?? 25000)
const rounds = Number(process.env.ROUNDS ?? 6)
const seed = Number(process.env.SEED ?? 20260803)

console.log(JSON.stringify({
  assumptions: {
    trials,
    seed,
    notes: [
      'This is a choice-floor diagnostic, not a full score simulator.',
      'Public Needs remain fixed during the persistent-hand streak test so weak-card persistence is visible.',
      'Directed trades count distinct offered cards that tend one of the player’s Public Needs and have at least one legal payment for the NPC.',
      'The complete-rulebook proxy counts a Special Action in hand as an additional path before its target-specific implementation is measured.',
      'The proposed Brainstorm Alternatives rule is not included.',
    ],
  },
  ordinaryStrategiesOnly: simulate({ trials, rounds, seed, includeSpecials: false }),
  completeDeckProxyWithSpecialActions: simulate({ trials, rounds, seed: seed + 1, includeSpecials: true }),
}, null, 2))
