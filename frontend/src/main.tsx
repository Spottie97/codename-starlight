import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Note: StrictMode disabled during development as it causes 
// double-mounting which interferes with WebSocket connections.
// Re-enable for production builds by wrapping App in <React.StrictMode>
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
)




