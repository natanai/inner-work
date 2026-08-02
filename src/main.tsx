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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
