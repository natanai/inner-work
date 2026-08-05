import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const [stickyHand, tradeLayer, cards, overrides, repairCss] = await Promise.all([
  read('src/tabletop/StickyStrategyHand.tsx'),
  read('src/tabletop/TradeDiscussionLayer.tsx'),
  read('src/tabletop/Cards.tsx'),
  read('src/tabletop/final-overrides.css'),
  read('src/tabletop/mobile-overwhelm-repair.css'),
])

assert.equal(stickyHand.includes('phase-aware-inline-hand'), false, 'The obsolete undocked grid hand must not be rendered.')
assert.equal(tradeLayer.includes('privateConfirmOpen'), false, 'The private-only magnifier confirmation flow must be removed.')
assert.equal(tradeLayer.includes('privateReviewOpen'), false, 'The private-only magnifier review dialog must be removed.')
assert.equal(tradeLayer.includes('inner-work:review-private'), false, 'The legacy private-only magnifier event must be removed.')
assert.equal(cards.includes("inner-work:open-magnifier"), true, 'Every Magnifier control must route to the official multi-use menu.')
assert.equal(overrides.includes('phase-aware-inline-hand.css'), false, 'The obsolete grid-hand stylesheet must not be imported.')
assert.equal(overrides.includes('mobile-overwhelm-repair.css'), true, 'The final mobile UX repair stylesheet must remain in the override chain.')
assert.equal(repairCss.includes('.mobile-deal-cognition.human .mobile-deal-hand-card > .special-action-face'), true, 'Initial-deal Special Actions must be constrained to the standard card frame.')
assert.equal(tradeLayer.includes('planning-action-strip'), true, 'Planning must expose compact primary actions before optional detail.')
assert.equal(tradeLayer.includes('planning-trade-workspace'), true, 'The Trade tile must enter a focused workspace.')
assert.equal(tradeLayer.includes('planning-trade-panel'), false, 'The duplicate Trading disclosure must not return.')

console.log('Mobile UX regression check passed: one undocked hand, one official Magnifier, normalized setup cards, and one focused Trade workspace.')
