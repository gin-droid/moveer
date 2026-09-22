import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initAccentColor } from '@/lib/accentColor'
initAccentColor()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)