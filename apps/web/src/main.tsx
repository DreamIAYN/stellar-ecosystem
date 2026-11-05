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
