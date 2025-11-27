import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import LoginDialog from './components/LoginDialog'
import { ThemeProvider, CssBaseline } from '@mui/material'
import theme from './theme'
import { LocaleProvider } from './context/LocaleContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocaleProvider>
        <AuthProvider>
          <AppProvider>
            <App />
            <LoginDialog />
          </AppProvider>
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  </StrictMode>,
)
