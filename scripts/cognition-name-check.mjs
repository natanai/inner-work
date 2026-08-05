import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

const originalRandom = Math.random
let seed = 0x1a2b3c4d
Math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0
  return seed / 0x100000000
}

try {
  const { assignRandomCognitionNames, COGNITION_NAME_CATALOG } = await server.ssrLoadModule('/src/tabletop/cognitionNames.ts')
  const { cognitionIdentity } = await server.ssrLoadModule('/src/tabletop/cognitionIdentity.ts')
  const { createTimedGame } = await server.ssrLoadModule('/src/tabletop/timedSpecialActions.ts')

  const playerNames = new Set()
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const game = assignRandomCognitionNames(createTimedGame())
    const names = game.cognitions.map((cognition) => cognition.name)

    assert.equal(new Set(names).size, 3, 'Every game must use three distinct Cognition names.')
    assert.equal(names.every((name) => COGNITION_NAME_CATALOG.includes(name)), true, 'Every assigned name must come from the catalogue.')
    playerNames.add(names[0])

    const player = cognitionIdentity(game.cognitions[0])
    const firstNpc = cognitionIdentity(game.cognitions[1])
    const secondNpc = cognitionIdentity(game.cognitions[2])
    assert.deepEqual([player.symbol, firstNpc.symbol, secondNpc.symbol], ['1', '2', '3'])
    assert.equal(player.role, 'You')
    assert.equal(firstNpc.role, 'NPC')
    assert.equal(secondNpc.role, 'NPC')

    assert.equal(cognitionIdentity('alpha').name, names[0], 'Id-only story views must retain the active randomized player name.')
    assert.equal(cognitionIdentity('beta').name, names[1], 'Id-only story views must retain the first NPC name.')
    assert.equal(cognitionIdentity('gamma').name, names[2], 'Id-only story views must retain the second NPC name.')
  }

  assert(playerNames.size > 1, 'The player name must vary across new games.')
  console.log('Cognition naming check passed: names are distinct, randomized, role-aware, and use readable numeric markers.')
} finally {
  Math.random = originalRandom
  await server.close()
}
