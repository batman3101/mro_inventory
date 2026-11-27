import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import './store/theme.store'
import App from './App.tsx'
import './styles/app.css'

// After a new deployment, a tab opened earlier still requests the previous
// build's page chunks (e.g. Inventory-<oldhash>.js), which no longer exist,
// and the page fails with "Failed to fetch dynamically imported module".
// Reload once to pick up the new build. The time guard stops a reload loop
// when a chunk is genuinely missing; then the error is shown as before.
const CHUNK_RELOAD_KEY = 'mro-chunk-reload-at'
window.addEventListener('vite:preloadError', () => {
  let lastReload = 0
  try {
    lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
  } catch {
    // storage unavailable (private mode): fall through and reload once
  }
  if (Date.now() - lastReload < 10_000) return
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  } catch {
    // ignore
  }
  // The router moves the address bar to the requested page only after this
  // failure settles; reloading on the next tick lands on that page instead of
  // the one being left.
  setTimeout(() => window.location.reload(), 0)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
