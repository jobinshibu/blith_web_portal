import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import store from './store'
import App from './App.jsx'
import './styles/main.scss'

if (typeof window !== 'undefined') {
  window.store = store;
  console.log(
    '%c[Memory Cache Ready]%c Type %cstore.getState().events%c in console to inspect in-memory cache',
    'color: #fff; background: #7C3AED; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    'color: #7C3AED; font-weight: bold; margin-left: 6px;',
    'color: #059669; font-weight: bold; font-family: monospace;',
    'color: #7C3AED;'
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)
