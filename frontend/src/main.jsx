import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import './styles/hud.css'
import './styles/panels.css'
import './styles/map.css'
import './styles/auth.css'
import './styles/storybook.css'
import './styles/layout.css'
import './styles/captain.css'
import './styles/mobile.css'
import './styles/sidebar.css'
import './styles/weather.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
