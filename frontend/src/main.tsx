import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Bootstrap } from './bootstrap/Bootstrap'
import './app/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
)
