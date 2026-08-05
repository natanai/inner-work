import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [badge, badgeCss, contribution, planning, mobilePlay, inventory, deal, setup, finalOverrides, principles] = await Promise.all([
  read('src/tabletop/CognitionSeatBadge.tsx'),
  read('src/tabletop/card-ux-system.css'),
  read('src/tabletop/StrategyContributionDetails.tsx'),
  read('src/tabletop/TradeDiscussionLayer.tsx'),
  read('src/tabletop/MobilePlayScreen.tsx'),
  read('src/tabletop/MobileInventoryBank.tsx'),
  read('src/tabletop/MobileDealScreen.tsx'),
  read('src/tabletop/SharedPersonSetupScreen.tsx'),
  read('src/tabletop/final-overrides.css'),
  read('docs/CARD_GAME_UX_PRINCIPLES.md'),
])

assert.match(badge, /cognition-seat-badge/, 'The reusable seat-badge component must own the visible circular marker.')
assert.match(badge, /cognitionIdentity\(cognition\)/, 'The seat badge must use the canonical identity accessor.')
assert.match(badgeCss, /font-variant-numeric: tabular-nums/, 'Seat badges must use stable numeric typography.')
assert.match(badgeCss, /place-items: center !important/, 'Seat badges must center their number through one rule.')

for (const [name, surface] of [['Strategy details', contribution], ['Planning', planning], ['Mobile table', mobilePlay], ['Inventory', inventory], ['Deal', deal], ['Setup', setup]]) {
  assert.match(surface, /CognitionSeatBadge/, `${name} must use the shared seat badge component.`)
}

assert.match(contribution, /sourceStrategyTitle/, 'Bonus details must identify the Strategy that created the Bonus Need.')
assert.match(contribution, /sourceCognitionName/, 'Bonus details must identify the Cognition that introduced the Bonus Need.')
assert.match(contribution, /strategy-bonus-origin/, 'Bonus provenance must be rendered in the detail row.')

assert.match(planning, /type PlanningView = 'overview' \| 'trade'/, 'Planning must have one explicit overview-to-trade state transition.')
assert.match(planning, /setView\('trade'\)/, 'The Trade tile must enter the trade workspace directly.')
assert.match(planning, /planning-trade-workspace/, 'Trade options must live in a focused workspace.')
assert.equal(planning.includes('planning-trade-panel'), false, 'The duplicate Trading disclosure must be removed.')
assert.equal(planning.includes('See trade options'), false, 'The Trade tile must not open another Trade toggle.')

assert.equal(mobilePlay.includes('Each Cognition qualifies through its own unresolved Needs.'), false, 'The redundant mobile Need banner must be removed.')
assert.equal(mobilePlay.includes('<header><span>Needs at a glance</span>'), false, 'The table should begin with the Need cards instead of a repeated explanation.')
assert.match(finalOverrides, /card-ux-system\.css/, 'The shared UX system must load after legacy overrides.')
assert.match(principles, /One control should lead to one task/, 'Repository guidance must preserve the no-duplicate-control rule.')
assert.match(principles, /Preserve provenance for generated game objects/, 'Repository guidance must preserve Bonus provenance.')

console.log('Card UX system check passed: canonical seat badges, Bonus provenance, one Trade workspace, and a quieter mobile table.')
