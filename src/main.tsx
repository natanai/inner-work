import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PlanningSheetCloseGuard } from './tabletop/PlanningSheetCloseGuard'
import './tabletop/base.css'
import './tabletop/table.css'
import './tabletop/responsive.css'
import './card-fronts.css'
import './high-resolution-cards.css'
import './tabletop/mobile.css'
import './tabletop/mobile-polish.css'
import './tabletop/situation-needs-flow.css'
import './tabletop/trading.css'
import './tabletop/private-choice-hand-stack.css'
import './tabletop/mobile-hand-pager.css'
import './tabletop/mobile-card-experience.css'
import './tabletop/mobile-ux-declutter.css'
import './tabletop/tactile-ux-pass.css'
import './tabletop/sticky-strategy-hand.css'
import './tabletop/sticky-strategy-hand-compat.css'
import './tabletop/sticky-hand-refinement.css'
import './tabletop/desktop-parity-story.css'
import './tabletop/desktop-planning-bridge.css'
import './tabletop/collective-story.css'
import './tabletop/mobile-story-table.css'
import './tabletop/situation-deck-orientation.css'
import './tabletop/mobile-deal-bank-polish.css'
import './tabletop/docked-hand-private-sleeve.css'
import './tabletop/strategy-contribution-details.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlanningSheetCloseGuard />
    <App />
  </StrictMode>,
)
