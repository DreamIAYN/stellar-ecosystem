import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource-variable/noto-sans-sc'
import './styles/base.css'
import './styles/shell.css'
import './styles/apps.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  if (!sessionStorage.getItem('stellar-chunk-retry')) {
    sessionStorage.setItem('stellar-chunk-retry', '1')
    const url = new URL(location.href)
    url.searchParams.set('v', String(Date.now()))
    location.replace(url.toString())
  }
})

setTimeout(() => sessionStorage.removeItem('stellar-chunk-retry'), 12000)

requestAnimationFrame(() => {
  const boot = document.getElementById('boot')
  if (boot) {
    boot.style.transition = 'opacity .45s ease'
    boot.style.opacity = '0'
    setTimeout(() => boot.remove(), 450)
  }
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {}))
}
