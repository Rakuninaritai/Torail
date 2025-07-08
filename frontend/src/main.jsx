import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './App.css'
import { BrowserRouter } from 'react-router-dom'
import { TeamProvider } from './context/TeamContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* ブラウザルーターで使えるようにする */}
    <BrowserRouter>
      {/* Theamproviderを使う */}
      <TeamProvider>
        <App />
      </TeamProvider>
    </BrowserRouter>
  </StrictMode>,
)
