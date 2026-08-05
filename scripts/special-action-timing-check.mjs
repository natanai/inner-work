import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const { needs, situations, strategies } = await server.ssrLoadModule('/src/data/cards.ts')
  const { encodeCommit } = await server.ssrLoadModule('/src/tabletop/commitSelection.ts')
  const { allStrategyCards, specialActionById } = await server.ssrLoadModule('/src/tabletop/specialActions.ts')
  const {
    applyDiscussionSpecialAction,
    canPlayVisible,
    continueTimedRound,
    createTimedGame,
    discussionActionActive,
    discussionActions,
    eventEffectsActive,
    groupPrivatePlayActive,
    ordinaryEffects,
    resolveTimedRound,
  } = await server.ssrLoadModule('/src/tabletop/timedSpecialActions.ts')

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
    alphaSelected = null,
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
    const game = createTimedGame()
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
      discussionActions: [],
    }
  }

  // SA1 must change the visible planning board immediately.
  {
    const sa1 = special('SA1')
    const game = makeGame({
      alphaHand: [sa1, ...filler.slice(0, 3)],
      alphaPublic: [slot(need('FN9')), slot(need('FN3'))],
      needDeck: [need('FN7'), ...needs.filter((card) => card.id !== 'FN7')],
    })
    const changed = applyDiscussionSpecialAction(game, 'alpha', 'SA1', 'alpha:FN9')
    assert.equal(changed.cognitions[0].publicNeeds.some((item) => item.card.id === 'FN9'), false)
    assert.equal(changed.cognitions[0].publicNeeds.some((item) => item.card.id === 'FN7'), true)
    assert.equal(changed.cognitions[0].hand.some((card) => card.id === 'SA1'), false)
    assert.equal(discussionActions(changed)[0]?.card.id, 'SA1')
  }

  // SA4 must introduce two current-round Bonus Needs before a Strategy is chosen.
  {
    const sa4 = special('SA4')
    const st27 = strategy('ST27')
    const game = makeGame({
      alphaHand: [sa4, st27, ...filler.slice(0, 2)],
      alphaPublic: [slot(need('FN3')), slot(need('FN17'))],
      alphaPrivate: slot(need('FN26')),
      needDeck: [need('FN7'), need('FN9'), ...needs.filter((card) => card.id !== 'FN7' && card.id !== 'FN9')],
    })
    assert.equal(canPlayVisible(game, game.cognitions[0], st27), false)
    const changed = applyDiscussionSpecialAction(game, 'alpha', 'SA4')
    assert.equal(changed.bonusNeeds.length, 2)
    assert.equal(changed.bonusNeeds.every((bonus) => bonus.availableRound === changed.round), true)
    assert.equal(changed.bonusNeeds.some((bonus) => bonus.need === 'Understanding'), true)
    assert.equal(canPlayVisible(changed, changed.cognitions[0], st27), true, 'SA4 must make the Understanding Strategy playable before reveal.')
    assert.equal(changed.cognitions[0].hand.some((card) => card.id === 'SA4'), false)
    assert.equal(discussionActionActive(changed, 'SA4'), true)

    const committed = { ...changed, cognitions: changed.cognitions.map((cognition) => cognition.id === 'alpha' ? { ...cognition, selected: st27.id } : cognition) }
    const resolved = resolveTimedRound(committed)
    assert.equal(resolved.roundLedger?.bonusAwards.some((award) => award.need === 'Understanding'), true)
    const continued = continueTimedRound(resolved)
    assert.equal(continued.cognitions[0].hand.length, 4, 'The immediately spent Discussion Action must be refilled after the round.')
  }

  // SA5 must likewise create Understanding in the live planning state.
  {
    const sa5 = special('SA5')
    const st27 = strategy('ST27')
    const game = makeGame({ alphaHand: [sa5, st27, ...filler.slice(0, 2)] })
    assert.equal(canPlayVisible(game, game.cognitions[0], st27), false)
    const changed = applyDiscussionSpecialAction(game, 'alpha', 'SA5')
    assert.equal(changed.bonusNeeds.some((bonus) => bonus.need === 'Understanding' && bonus.availableRound === changed.round), true)
    assert.equal(canPlayVisible(changed, changed.cognitions[0], st27), true)
  }

  // SA6 must alter previews and effects during Discussion, not only at reveal.
  {
    const sa6 = special('SA6')
    const st1 = strategy('ST1')
    const game = makeGame({ alphaHand: [sa6, st1, ...filler.slice(0, 2)], situationCard: situation('S1') })
    assert.equal(game.situation.event, false)
    assert.equal(ordinaryEffects(game, st1).some((effect) => effect.need === 'Predictability'), false)
    const changed = applyDiscussionSpecialAction(game, 'alpha', 'SA6')
    assert.equal(eventEffectsActive(changed), true)
    assert.equal(ordinaryEffects(changed, st1).some((effect) => effect.need === 'Predictability' && effect.amount === -1), true)
  }

  // SA3 must immediately open an explicit Private-Need assignment mode.
  {
    const sa3 = special('SA3')
    const game = makeGame({ betaHand: [sa3, ...filler.slice(2, 5)] })
    const changed = applyDiscussionSpecialAction(game, 'beta', 'SA3')
    assert.equal(groupPrivatePlayActive(changed), true)
    assert.equal(changed.cognitions[1].hand.some((card) => card.id === 'SA3'), false)
  }

  // A Group Therapy private assignment that misses must produce no Strategy effects.
  {
    const sa3 = special('SA3')
    const st21 = strategy('ST21')
    let game = makeGame({
      alphaHand: [st21, ...filler.slice(0, 3)],
      alphaSelected: encodeCommit({ strategyId: st21.id, specialId: null, target: null, playForPrivate: true }),
      alphaPublic: [slot(need('FN3'), 2), slot(need('FN17'))],
      alphaPrivate: slot(need('FN7')),
      betaHand: [sa3, ...filler.slice(2, 5)],
    })
    game = applyDiscussionSpecialAction(game, 'beta', 'SA3')
    const resolved = resolveTimedRound(game)
    const alphaLine = resolved.resolution.find((line) => line.cognitionId === 'alpha')
    assert.equal(alphaLine?.legal, false)
    assert.equal(alphaLine?.shared, 0)
    assert.equal(resolved.cognitions[0].publicNeeds.find((item) => item.card.id === 'FN3')?.gifts, 2, 'A failed private-targeted Safety Strategy must not tend the visible Safety Need.')
    assert.equal(resolved.cognitions[0].privateNeed.gifts, 1, 'The unmet Private Need remains in play.')
  }

  // A Group Therapy private assignment that matches must resolve normally.
  {
    const sa3 = special('SA3')
    const st27 = strategy('ST27')
    let game = makeGame({
      alphaHand: [st27, ...filler.slice(0, 3)],
      alphaSelected: encodeCommit({ strategyId: st27.id, specialId: null, target: null, playForPrivate: true }),
      alphaPublic: [slot(need('FN3')), slot(need('FN17'))],
      alphaPrivate: slot(need('FN7')),
      betaHand: [sa3, ...filler.slice(2, 5)],
    })
    game = applyDiscussionSpecialAction(game, 'beta', 'SA3')
    const resolved = resolveTimedRound(game)
    assert.equal(resolved.resolution.find((line) => line.cognitionId === 'alpha')?.legal, true)
    assert.equal(resolved.cognitions[0].privateScore, 1)
    assert.equal(resolved.cognitions[0].privateNeed.gifts, 0)
  }

  // SA2 is configured as a private-targeted pair. A mismatch spends both cards and suppresses all effects.
  {
    const sa2 = special('SA2')
    const st21 = strategy('ST21')
    const game = makeGame({
      alphaHand: [sa2, st21, ...filler.slice(0, 2)],
      alphaSelected: encodeCommit({ strategyId: st21.id, specialId: sa2.id, target: null, playForPrivate: true }),
      alphaPublic: [slot(need('FN3'), 2), slot(need('FN17'))],
      alphaPrivate: slot(need('FN7')),
    })
    const resolved = resolveTimedRound(game)
    const line = resolved.resolution.find((item) => item.cognitionId === 'alpha')
    assert.equal(line?.legal, false)
    assert.equal(resolved.sharedScore, 0)
    assert.equal(resolved.cognitions[0].publicNeeds.find((item) => item.card.id === 'FN3')?.gifts, 2)
    assert.equal(resolved.cognitions[0].privateNeed.gifts, 1)
    const continued = continueTimedRound(resolved)
    assert.equal(continued.cognitions[0].hand.some((card) => card.id === 'SA2' || card.id === 'ST21'), false, 'The failed Special Action and Strategy must both leave the hand.')
  }

  // SA2 match: the Strategy qualifies through the Private Need and resolves.
  {
    const sa2 = special('SA2')
    const st27 = strategy('ST27')
    const game = makeGame({
      alphaHand: [sa2, st27, ...filler.slice(0, 2)],
      alphaSelected: encodeCommit({ strategyId: st27.id, specialId: sa2.id, target: null, playForPrivate: true }),
      alphaPublic: [slot(need('FN3')), slot(need('FN17'))],
      alphaPrivate: slot(need('FN7')),
    })
    const resolved = resolveTimedRound(game)
    assert.equal(resolved.resolution.find((line) => line.cognitionId === 'alpha')?.legal, true)
    assert.equal(resolved.cognitions[0].privateScore, 1)
  }

  // SA7 remains a Start-of-Play pair and boosts the chosen effect before resolution.
  {
    const sa7 = special('SA7')
    const st27 = strategy('ST27')
    const game = makeGame({
      alphaHand: [sa7, st27, ...filler.slice(0, 2)],
      alphaSelected: encodeCommit({ strategyId: st27.id, specialId: sa7.id, target: 'Understanding', playForPrivate: false }),
      alphaPublic: [slot(need('FN7'), 5), slot(need('FN3'))],
    })
    const resolved = resolveTimedRound(game)
    const change = resolved.roundLedger?.publicChanges.find((item) => item.cognitionId === 'alpha' && item.need === 'Understanding')
    assert.equal(change?.removed, 5)
  }

  console.log('Special Action timing check passed: Discussion Actions resolve immediately, private-targeted commitments are conditional, and paired failures produce no Strategy effects.')
} finally {
  await server.close()
}
