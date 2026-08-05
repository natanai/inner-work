import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const paths = [
  'src/tabletop/MobilePlayScreen.tsx',
  'src/tabletop/MobileDealScreen.tsx',
  'src/tabletop/MobileInventoryBank.tsx',
  'src/tabletop/TradeDiscussionLayer.tsx',
  'src/tabletop/DesktopTableau.tsx',
  'src/tabletop/PlayScreen.tsx',
]

const [identity, participants, setup, app, mobileStory, desktopStory, narrative, ...surfaces] = await Promise.all([
  read('src/tabletop/cognitionIdentity.ts'),
  read('src/tabletop/gameParticipants.ts'),
  read('src/tabletop/SharedPersonSetupScreen.tsx'),
  read('src/App.tsx'),
  read('src/tabletop/MobileStoryTable.tsx'),
  read('src/tabletop/DesktopStoryTable.tsx'),
  read('src/tabletop/storyNarrative.ts'),
  ...paths.map(read),
])

assert.match(identity, /alpha: '1'[\s\S]*beta: '2'[\s\S]*gamma: '3'/, 'Internal Cognition ids must map to seats 1, 2, and 3 in one place.')
assert.match(identity, /export function cognitionSeat/, 'The canonical seat accessor must be exported.')

for (let index = 0; index < surfaces.length; index += 1) {
  assert.equal(/[αβγ]/.test(surfaces[index]), false, `${paths[index]} must not render legacy Greek badges.`)
}
assert.equal(surfaces[0].includes('function cognitionSymbol'), false, 'MobilePlayScreen must not invent its own Cognition badge mapping.')

assert.match(participants, /sharedPersonName/, 'The shared person must have one canonical game-state accessor.')
assert.match(participants, /return \{ \.\.\.game, sharedPersonName: name \}/, 'The chosen person name must be stored on the game object.')
assert.match(setup, /Three Cognitions influence one person/, 'The naming step must briefly establish the premise.')
assert.match(setup, /You are/, 'The naming step must reveal the player’s assigned Cognition.')
assert.match(setup, /Who are you collectively influencing\?/, 'The naming step must ask for the person’s name.')
assert.match(app, /screen === 'shared-person'/, 'The naming step must occur before card setup.')
assert.match(app, /withSharedPersonName/, 'App must store the chosen name before continuing.')

assert.match(narrative, /const person = sharedPersonName\(game\)/, 'Generated stories must use the canonical person name.')
assert.match(mobileStory, /sharedPersonName\(game\)/, 'Mobile Story Table must use the canonical person name.')
assert.match(desktopStory, /sharedPersonName\(game\)/, 'Desktop Story Table must use the canonical person name.')
assert.equal(mobileStory.includes('the shared person chose to'), false, 'Mobile Story Table must not fall back to the old generic action phrase.')
assert.equal(desktopStory.includes('the shared person chose to'), false, 'Desktop Story Table must not fall back to the old generic action phrase.')

console.log('Participant identity check passed: one seat system, one Cognition identity source, and one named person across both Story Tables.')
