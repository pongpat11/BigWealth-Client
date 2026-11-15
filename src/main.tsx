import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initTheme } from './lib/theme'

// Before first paint, so a dark-mode user never sees a light flash.
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* basename tracks Vite's base so routing works under the GitHub Pages sub-path */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
