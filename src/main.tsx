import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './estilo.css'
import { ligarCliqueGlobal } from './som'

ligarCliqueGlobal()

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
