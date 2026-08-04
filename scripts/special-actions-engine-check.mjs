import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const { needs, situations, strategies } = await server.ssrLoadModule('/src/data/cards.ts')
  const { encodeCommit, parseCommit, setOrdinaryCommit } = await server.ssrLoadModule('/src/tabletop/commitSelection.ts')
  const { canPlayCommitted, continueRound, createGame, resolveRound } = await server.ssrLoadModule('/src/tabletop/model.ts')
  const {
    allStrategyCards,
    enabledSpecialActionIds,
    specialActionById,
    specialActionRequiresStrategy,
    specialActionTiming,
  } = await server.ssrLoadModule('/src/tabletop/specialActions.ts')

  const need = (id) => {
    const card = needs.find((item) => item.id === id)
    assert(card, `Missing Need card ${id}`)
    return card
  }
  const strategy = (id) => {
    const card = strategies.find((item) => item.id === id)
    assert(card, `Missing Strategy card ${id}`)
    return card
  }
  const special = (id) => {
    const card = specialActionById(id)
    assert(card, `Missing Special Action ${id}`)
    return card
  }
  const situation = (id) => {
    const card = situations.find((item) => item.id === id)
    assert(card, `Missing Situation ${id}`)
    return card
  }
  const slot = (card, gifts = 1) => ({
    card,
    gifts,
    setup: { base: gifts, situation: 0, multiplied: false, total: gifts },
  })

  const filler = ['ST35', 'ST43', 'ST37', 'ST50', 'ST21', 'ST24', 'ST31', 'ST46'].map(strategy)

  function makeGame({
    alphaHand,
    alphaSelected,
    alphaPublic = [slot(need('FN3')), slot(need('FN17'))],
    alphaPrivate = slot(need('FN26')),
    betaHand = filler.slice(2, 6),
    betaSelected = null,
    betaPublic = [slot(need('FN5')), slot(need('FN11'))],
    betaPrivate = slot(need('FN23')),
    gammaHand = filler.slice(4, 8),
    gammaSelected = null,
    gammaPublic = [slot(need('FN15')), slot(need('FN28'))],
    gammaPrivate = slot(need('FN29')),
    needDeck = needs,
    situationCard = situation('S1'),
  }) {
    const game = createGame()
    const [alpha, beta, gamma] = game.cognitions
    const cognitions = [
      { ...alpha, human: true, publicNeeds: alphaPublic, privateNeed: alphaPrivate, hand: alphaHand, selected: alphaSelected },
      { ...beta, human: true, publicNeeds: betaPublic, privateNeed: betaPrivate, hand: betaHand, selected: betaSelected },
      { ...gamma, human: true, publicNeeds: gammaPublic, privateNeed: gammaPrivate, hand: gammaHand, selected: gammaSelected },
    ]
    const held = new Set(cognitions.flatMap((cognition) => cognition.hand.map((card) => card.id)))
    return {
      ...game,
      cognitions,
      situation: situationCard,
      needDeck: [...needDeck],
      strategyDeck: allStrategyCards.filter((card) => !held.has(card.id)),
      bonusNeeds: [],
      sharedScore: 0,
      round: 1,
      phase: 'planning',
      resolution: [],
      roundLedger: null,
    }
  }

  function assertRefill(resolved, cognitionId, usedIds) {
    const continued = continueRound(resolved)
    const cognition = continued.cognitions.find((item) => item.id === cognitionId)
    assert(cognition, `Missing ${cognitionId} after refill`)
    assert.equal(cognition.hand.length, 4, `${cognitionId} must refill to four total cards.`)
    usedIds.forEach((id) => assert.equal(cognition.hand.some((card) => card.id === id), false, `${id} must leave the used hand.`))
  }

  assert.deepEqual(
    enabledSpecialActionIds,
    ['SA1', 'SA2', 'SA3', 'SA4', 'SA5', 'SA6', 'SA7'],
    'The production deck must explicitly include all seven source Special Actions.',
  )
  assert.equal(allStrategyCards.length, 61, 'The complete active deck must contain 54 ordinary Strategies and 7 Special Actions.')
  assert.equal(new Set(allStrategyCards.map((card) => card.id)).size, 61, 'Every active Strategy-deck ID must be unique.')
  assert.equal(specialActionTiming(special('SA1')), 'Discussion Phase')
  assert.equal(specialActionTiming(special('SA7')), 'Start of Play Phase')
  assert.equal(specialActionRequiresStrategy(special('SA2')), true)
  assert.equal(specialActionRequiresStrategy(special('SA7')), true)
  assert.equal(specialActionRequiresStrategy(special('SA5')), false)

  const invalidDeepBreath = setOrdinaryCommit(
    encodeCommit({ strategyId: 'ST27', specialId: 'SA7', target: 'Understanding' }),
    null,
  )
  assert.equal(invalidDeepBreath, null, 'Removing the paired Strategy must also remove Deep Breath.')
  const standaloneEffectiveCommunication = setOrdinaryCommit(
    encodeCommit({ strategyId: 'ST27', specialId: 'SA5', target: null }),
    null,
  )
  assert.equal(parseCommit(standaloneEffectiveCommunication).specialId, 'SA5', 'A standalone-capable Special Action must remain committed.')

  // SA1 — replace one unresolved Public Need before ordinary Strategy resolution.
  {
    const sa1 = special('SA1')
    const game = makeGame({
      alphaHand: [sa1, ...filler.slice(0, 3)],
      alphaSelected: encodeCommit({ strategyId: null, specialId: sa1.id, target: 'alpha:FN9' }),
      alphaPublic: [slot(need('FN9')), slot(need('FN3'))],
      needDeck: [need('FN7'), ...needs.filter((card) => card.id !== 'FN7')],
    })
    const resolved = resolveRound(game)
    const alpha = resolved.cognitions.find((item) => item.id === 'alpha')
    assert(alpha)
    assert.equal(alpha.publicNeeds.some((publicNeed) => publicNeed.card.id === 'FN9'), false)
    assert.equal(alpha.publicNeeds.some((publicNeed) => publicNeed.card.id === 'FN7'), true)
    assert.equal(resolved.roundLedger?.specialActions.some((use) => use.card.id === 'SA1'), true)
    assertRefill(resolved, 'alpha', ['SA1'])
  }

  // SA2 — let the acting Cognition qualify through its own hidden Private Need.
  {
    const sa2 = special('SA2')
    const st27 = strategy('ST27')
    const game = makeGame({
      alphaHand: [sa2, st27, ...filler.slice(0, 2)],
      alphaSelected: encodeCommit({ strategyId: st27.id, specialId: sa2.id, target: null }),
      alphaPublic: [slot(need('FN9')), slot(need('FN3'))],
      alphaPrivate: slot(need('FN7')),
    })
    const ordinaryOnly = {
      ...game,
      cognitions: game.cognitions.map((cognition) => cognition.id === 'alpha' ? { ...cognition, selected: st27.id } : cognition),
    }
    assert.equal(canPlayCommitted(ordinaryOnly, ordinaryOnly.cognitions[0], st27), false, 'ST27 must be illegal before Deep Introspection opens the Private Need path.')
    const resolved = resolveRound(game)
    const line = resolved.resolution.find((item) => item.cognitionId === 'alpha')
    assert.equal(line?.legal, true)
    assert.equal(line?.specialAction?.id, 'SA2')
    assert.equal(resolved.cognitions[0].privateScore, game.cognitions[0].privateScore + 1)
    assertRefill(resolved, 'alpha', ['SA2', 'ST27'])
  }

  // SA3 — open each Cognition's own Private Need as a qualifying route.
  {
    const sa3 = special('SA3')
    const st27 = strategy('ST27')
    const game = makeGame({
      alphaHand: [sa3, ...filler.slice(0, 3)],
      alphaSelected: encodeCommit({ strategyId: null, specialId: sa3.id, target: null }),
      betaHand: [st27, ...filler.slice(3, 6)],
      betaSelected: st27.id,
      betaPublic: [slot(need('FN9')), slot(need('FN3'))],
      betaPrivate: slot(need('FN7')),
    })
    const resolved = resolveRound(game)
    const betaLine = resolved.resolution.find((item) => item.cognitionId === 'beta')
    assert.equal(betaLine?.legal, true)
    assert.equal(resolved.cognitions.find((item) => item.id === 'beta')?.privateScore, game.cognitions[1].privateScore + 1)
    assert.equal(resolved.roundLedger?.specialActions.some((use) => use.card.id === 'SA3'), true)
    assertRefill(resolved, 'alpha', ['SA3'])
    assertRefill(resolved, 'beta', ['ST27'])
  }

  // SA4 — introduce two immediately active Bonus Needs.
  {
    const sa4 = special('SA4')
    const st27 = strategy('ST27')
    const game = makeGame({
      alphaHand: [sa4, st27, ...filler.slice(0, 2)],
      alphaSelected: encodeCommit({ strategyId: st27.id, specialId: sa4.id, target: null }),
      alphaPublic: [slot(need('FN3')), slot(need('FN17'))],
      alphaPrivate: slot(need('FN26')),
      needDeck: [need('FN7'), need('FN9'), ...needs.filter((card) => card.id !== 'FN7' && card.id !== 'FN9')],
    })
    const resolved = resolveRound(game)
    const line = resolved.resolution.find((item) => item.cognitionId === 'alpha')
    assert.equal(line?.legal, true, 'The newly introduced Understanding Bonus Need must make ST27 legal immediately.')
    assert.equal(resolved.roundLedger?.bonusAwards.some((award) => award.need === 'Understanding'), true)
    assert.equal(resolved.bonusNeeds.some((bonus) => bonus.need === 'Peace' && bonus.gifts === 1), true, 'The second untended Bonus Need must remain active.')
    assert.equal(resolved.cognitions[0].bonusScore, game.cognitions[0].bonusScore + 1)
    assertRefill(resolved, 'alpha', ['SA4', 'ST27'])
  }

  // SA5 — introduce Understanding before legality and Bonus scoring are checked.
  {
    const sa5 = special('SA5')
    const st27 = strategy('ST27')
    const game = makeGame({
      alphaHand: [sa5, st27, ...filler.slice(0, 2)],
      alphaSelected: encodeCommit({ strategyId: st27.id, specialId: sa5.id, target: null }),
      alphaPublic: [slot(need('FN9')), slot(need('FN3'))],
      alphaPrivate: slot(need('FN17')),
    })
    const resolved = resolveRound(game)
    const line = resolved.resolution.find((item) => item.cognitionId === 'alpha')
    assert.equal(line?.legal, true)
    assert.equal(line?.specialAction?.id, 'SA5')
    assert.equal(resolved.roundLedger?.bonusAwards.some((award) => award.need === 'Understanding'), true)
    assert.equal(resolved.cognitions[0].bonusScore, game.cognitions[0].bonusScore + 1)
    assertRefill(resolved, 'alpha', ['SA5', 'ST27'])
  }

  // SA6 — activate Event effects on every ordinary Strategy this round.
  {
    const sa6 = special('SA6')
    const st1 = strategy('ST1')
    const game = makeGame({
      alphaHand: [sa6, st1, ...filler.slice(0, 2)],
      alphaSelected: encodeCommit({ strategyId: st1.id, specialId: sa6.id, target: null }),
      alphaPublic: [slot(need('FN13')), slot(need('FN3'))],
      situationCard: situation('S1'),
    })
    assert.equal(game.situation.event, false)
    const resolved = resolveRound(game)
    assert.equal(resolved.resolution.find((item) => item.cognitionId === 'alpha')?.legal, true)
    assert.equal(resolved.roundLedger?.bonusCreated.some((bonus) => bonus.need === 'Predictability' && bonus.sourceStrategyId === 'ST1'), true, 'ST1 event effect must create Predictability for next round.')
    assertRefill(resolved, 'alpha', ['SA6', 'ST1'])
  }

  // SA7 — add exactly +3 to one selected positive effect.
  {
    const sa7 = special('SA7')
    const st27 = strategy('ST27')
    const game = makeGame({
      alphaHand: [sa7, st27, ...filler.slice(0, 2)],
      alphaSelected: encodeCommit({ strategyId: st27.id, specialId: sa7.id, target: 'Understanding' }),
      alphaPublic: [slot(need('FN7'), 5), slot(need('FN3'))],
    })
    const resolved = resolveRound(game)
    const change = resolved.roundLedger?.publicChanges.find((item) => item.cognitionId === 'alpha' && item.need === 'Understanding')
    assert.equal(change?.removed, 5, 'Understanding +2 must become +5 after Deep Breath.')
    assert.equal(change?.after, 0)
    assert.equal(resolved.roundLedger?.specialActions.find((use) => use.card.id === 'SA7')?.target, 'Understanding')
    assertRefill(resolved, 'alpha', ['SA7', 'ST27'])
  }

  console.log('Special Action engine check passed: all seven cards, pairing rules, scoring, discard, and refill behavior are verified.')
} finally {
  await server.close()
}
