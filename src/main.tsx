import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
