import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppProvider } from './context/AppContext'
import { NotificationProvider } from './context/NotificationContext'
import { AuthProvider } from './context/AuthContext'
import LoginDialog from './components/LoginDialog'
import { LocaleProvider } from './context/LocaleContext'
// Fully disable service workers (remove offline mode in all environments).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
  if (window.caches) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocaleProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppProvider>
            <App />
            <LoginDialog />
          </AppProvider>
        </NotificationProvider>
      </AuthProvider>
    </LocaleProvider>
  </StrictMode>,
)
