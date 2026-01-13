import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppProvider } from './context/AppContext'
import { NotificationProvider } from './context/NotificationContext'
import { AuthProvider } from './context/AuthContext'
import LoginDialog from './components/LoginDialog'
import { LocaleProvider } from './context/LocaleContext'

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
