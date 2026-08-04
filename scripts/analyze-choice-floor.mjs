import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const { needs, situations, strategies } = await server.ssrLoadModule('/src/data/cards.ts')
  const { createGame } = await server.ssrLoadModule('/src/tabletop/model.ts')
  const { enumeratePlanningPaths, summarizePlanningPaths } = await server.ssrLoadModule('/src/tabletop/planningPaths.ts')
  const { allStrategyCards } = await server.ssrLoadModule('/src/tabletop/specialActions.ts')

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

  const slot = (card) => ({
    card,
    gifts: 1,
    setup: { base: 1, situation: 0, multiplied: false, total: 1 },
  })

  function bucket(value) { return value >= 4 ? '4+' : String(value) }
  function increment(map, key) { map[key] = (map[key] ?? 0) + 1 }

  function makeGame(template, situation, needsByCognition, hands, deck) {
    const cognitions = template.cognitions.map((cognition, index) => ({
      ...cognition,
      human: index === 0,
      publicNeeds: needsByCognition[index].slice(1).map(slot),
      privateNeed: slot(needsByCognition[index][0]),
      hand: hands[index],
      selected: null,
      magnifierUsed: false,
    }))
    return {
      ...template,
      cognitions,
      situation,
      strategyDeck: deck,
      bonusNeeds: [],
      round: 1,
      phase: 'planning',
      resolution: [],
      roundLedger: null,
    }
  }

  function simulate({ trials, rounds, seed, includeSpecials }) {
    const rng = rngFrom(seed)
    const template = createGame()
    const activeDeck = includeSpecials ? allStrategyCards : strategies
    const legalDistribution = {}
    const knownSpentDistribution = {}
    const visibleReadyDistribution = {}
    const uncertainDistribution = {}
    const specialCardDistribution = {}
    const specialRouteDistribution = {}
    const tradeRouteDistribution = {}
    const narrowStreaks = {}
    const needLegalCounts = Object.fromEntries([...new Set(needs.map((need) => need.need))].map((need) => [need, { seen: 0, playable: 0 }]))

    for (let trial = 0; trial < trials; trial += 1) {
      const situation = situations[Math.floor(rng() * situations.length)]
      const needDeck = shuffle(needs, rng)
      const needsByCognition = [0, 1, 2].map((index) => needDeck.slice(index * 3, index * 3 + 3))
      const fullDeck = shuffle(activeDeck, rng)
      let cursor = 0
      let hands = [0, 1, 2].map(() => {
        const hand = fullDeck.slice(cursor, cursor + 4)
        cursor += 4
        return hand
      })
      let game = makeGame(template, situation, needsByCognition, hands, fullDeck.slice(cursor))

      const visiblePaths = enumeratePlanningPaths(game, { privacy: 'player' })
      const actualPaths = enumeratePlanningPaths(game, { privacy: 'omniscient' })
      const spentGame = {
        ...game,
        cognitions: game.cognitions.map((cognition, index) => index === 0 ? { ...cognition, magnifierUsed: true } : cognition),
      }
      const spentSummary = summarizePlanningPaths(enumeratePlanningPaths(spentGame, { privacy: 'player' }))
      const visibleSummary = summarizePlanningPaths(visiblePaths)
      const actualSummary = summarizePlanningPaths(actualPaths)
      const legal = actualPaths.filter((path) => path.kind === 'strategy').length
      const specialCards = hands[0].filter((card) => card.id.startsWith('SA')).length

      increment(legalDistribution, bucket(legal))
      increment(knownSpentDistribution, bucket(spentSummary.known))
      increment(visibleReadyDistribution, bucket(visibleSummary.known))
      increment(uncertainDistribution, bucket(visibleSummary.uncertain))
      increment(specialCardDistribution, bucket(specialCards))
      increment(specialRouteDistribution, bucket(actualSummary.special))
      increment(tradeRouteDistribution, bucket(actualSummary.trade))

      for (const need of needsByCognition[0].slice(1)) {
        needLegalCounts[need.need].seen += 1
        const oneNeedGame = {
          ...game,
          cognitions: game.cognitions.map((cognition, index) => index === 0 ? { ...cognition, publicNeeds: [slot(need)] } : cognition),
        }
        if (enumeratePlanningPaths(oneNeedGame, { privacy: 'omniscient' }).some((path) => path.kind === 'strategy')) {
          needLegalCounts[need.need].playable += 1
        }
      }

      let currentStreak = 0
      let longestStreak = 0
      for (let round = 0; round < rounds; round += 1) {
        const strategyPaths = enumeratePlanningPaths(game, { privacy: 'omniscient' }).filter((path) => path.kind === 'strategy')
        if (strategyPaths.length <= 1) {
          currentStreak += 1
          longestStreak = Math.max(longestStreak, currentStreak)
        } else currentStreak = 0

        const selectedId = strategyPaths[Math.floor(rng() * Math.max(1, strategyPaths.length))]?.id.replace('strategy:', '')
        const playerHand = game.cognitions[0].hand
        const removed = selectedId
          ? playerHand.find((card) => card.id === selectedId)
          : playerHand[Math.floor(rng() * playerHand.length)]
        hands = game.cognitions.map((cognition) => [...cognition.hand])
        hands[0] = hands[0].filter((card) => card.id !== removed?.id)
        while (hands[0].length < 4) {
          if (cursor >= fullDeck.length) cursor = 0
          const candidate = fullDeck[cursor++]
          if (candidate && !hands.flat().some((card) => card.id === candidate.id)) hands[0].push(candidate)
        }
        game = {
          ...game,
          cognitions: game.cognitions.map((cognition, index) => ({ ...cognition, hand: hands[index], selected: null })),
          round: game.round + 1,
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
      legalOrdinaryStrategies: normalize(legalDistribution),
      knownRoutesAfterMagnifierIsSpent: normalize(knownSpentDistribution),
      knownRoutesWhileMagnifierIsReady: normalize(visibleReadyDistribution),
      hiddenOrPermissionBasedPossibilities: normalize(uncertainDistribution),
      specialActionCardsInHand: normalize(specialCardDistribution),
      actualSpecialActionRoutes: normalize(specialRouteDistribution),
      directedTradeRoutes: normalize(tradeRouteDistribution),
      longestConsecutiveRoundsWithAtMostOneLegalOrdinaryStrategy: normalize(narrowStreaks),
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
        'The app and simulator use the same canonical planning-route evaluator.',
        'A route is a qualitatively distinct action family; target and pairing counts are retained as configurations rather than inflating the top-level route count.',
        'Private-Need matches and NPC permission are shown to the player as uncertain possibilities, while the omniscient diagnostic may verify whether those routes actually exist.',
        'The Magnifier contributes up to four routes; its card subsets and Need targets are configurations within those routes.',
        'The proposed Brainstorm Alternatives rule is not included.',
      ],
    },
    ordinaryStrategiesOnly: simulate({ trials, rounds, seed, includeSpecials: false }),
    completeRulebookDeck: simulate({ trials, rounds, seed: seed + 1, includeSpecials: true }),
  }, null, 2))
} finally {
  await server.close()
}
