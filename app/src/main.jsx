import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './i18n'
import './index.css'
import { AuthProvider } from './lib/auth.jsx'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Projekt-Seite auf GitHub Pages liegt unter /dally/, siehe vite.config.js */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
