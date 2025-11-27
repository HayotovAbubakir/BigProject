import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { useLocale } from './context/LocaleContext'
import { ThemeModeContext } from './context/ThemeModeContext'
import enableDevToolsLock from './utils/devToolsLock'
import { lightTheme, darkTheme } from './theme'

import Layout from './components/Layout'
const ReceiptApp = React.lazy(() => import('./components/ReceiptApp'))
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Warehouse = React.lazy(() => import('./pages/Warehouse'))
const Store = React.lazy(() => import('./pages/Store'))
const Accounts = React.lazy(() => import('./pages/Accounts'))
const Logs = React.lazy(() => import('./pages/Logs'))
const Credits = React.lazy(() => import('./pages/Credits'))

const App = () => {
  const { t } = useLocale()
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    try {
      const saved = localStorage.getItem('theme_mode')
      return saved ? JSON.parse(saved) : false
    } catch (err) {
      console.debug('Failed to load theme preference', err)
      return false
    }
  })

  React.useEffect(() => {
    try {
      localStorage.setItem('theme_mode', JSON.stringify(isDarkMode))
    } catch (err) {
      console.debug('Failed to save theme preference', err)
    }
  }, [isDarkMode])

  // Enable DevTools lock on mount
  React.useEffect(() => {
    enableDevToolsLock()
  }, [])

  const currentTheme = isDarkMode ? darkTheme : lightTheme

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      <ThemeModeContext.Provider value={{ isDarkMode, setIsDarkMode }}>
        <BrowserRouter>
          <Suspense fallback={<div>{t('loading')}</div>}>
            <Layout>
              <Routes>
                <Route path="/receipt" element={<ReceiptApp />} />
                <Route path="/" element={<Dashboard />} />
                <Route path="/warehouse" element={<Warehouse />} />
                <Route path="/store" element={<Store />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/credits" element={<Credits />} />
              </Routes>
            </Layout>
          </Suspense>
        </BrowserRouter>
      </ThemeModeContext.Provider>
    </ThemeProvider>
  )
}

export default App