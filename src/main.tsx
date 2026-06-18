import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Jini from './Jini.tsx'
import Docs from './Docs.tsx'

const isDocsRoute = window.location.pathname === '/docs' || window.location.pathname.startsWith('/docs/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDocsRoute ? <Docs /> : <Jini />}
  </StrictMode>,
)
