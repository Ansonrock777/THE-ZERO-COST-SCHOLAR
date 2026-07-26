import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Tokens and component classes first, application layout second — the app
// sheet is allowed to override the system, never the other way round.
import './styles/design-system.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
