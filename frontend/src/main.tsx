import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Bootstrap } from './bootstrap/Bootstrap'
import './app/styles.css'

const root = createRoot(document.getElementById('root')!)
const pathname = window.location.pathname.replace(/\/+$/, '')
const isIrisLabRoute = pathname === '/dev/iris-lab' || pathname === '/dev/iris-la'

if (import.meta.env.DEV && isIrisLabRoute) {
  void import('./iris-lab/IrisLab').then(({ IrisLab }) => root.render(<StrictMode><IrisLab /></StrictMode>))
} else {
  root.render(<StrictMode><Bootstrap /></StrictMode>)
}
