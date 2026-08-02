import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './tabletop/base.css'
import './tabletop/table.css'
import './tabletop/responsive.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
