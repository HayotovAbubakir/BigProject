import React from 'react'
import { AppBar, Toolbar, Typography, Drawer, List, ListItemButton, ListItemText, Box, IconButton, Button, useTheme, useMediaQuery, TextField, Select, MenuItem, FormControl, InputLabel, Snackbar, Alert } from '@mui/material'
import { useLocation } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import { Link as RouterLink } from 'react-router-dom'
import LogoutIcon from '@mui/icons-material/Lock'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import AccountManager from './AccountManager'
import AccountLock from './AccountLock'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import { useApp } from '../context/AppContext'
import { ThemeModeContext } from '../context/ThemeModeContext'

const navItemsBase = [
  { to: '/', key: 'dashboard' },
  { to: '/warehouse', key: 'warehouse' },
  { to: '/store', key: 'store' },
  { to: '/accounts', key: 'accounts' },
  { to: '/logs', key: 'logs' },
  { to: '/credits', key: 'credits' },
]

function Layout({ children }) {
  const { logout, user } = useAuth()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [accountManagerOpen, setAccountManagerOpen] = React.useState(false)
  const [accountSnackbarOpen, setAccountSnackbarOpen] = React.useState(false)
  const [accountLockOpen, setAccountLockOpen] = React.useState(false)

  const { t, locale, setLocale } = useLocale()
  const { state, dispatch } = useApp()
  const { isDarkMode, setIsDarkMode } = React.useContext(ThemeModeContext)
  const [rateInput, setRateInput] = React.useState(state?.exchangeRate || '')
  const displayCurrency = state?.ui?.displayCurrency || 'UZS'
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const location = useLocation()

  const navItems = navItemsBase.map(n => ({ ...n, label: t(n.key) || n.key }))

  const drawer = (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, pt: 1 }}>
        <Button size="small" color="inherit" onClick={() => setLocale(locale === 'uz' ? 'en' : 'uz')} sx={{ textTransform: 'none' }}>
          {locale === 'uz' ? 'EN' : 'UZ'}
        </Button>
        <IconButton size="small" color="inherit" onClick={() => setIsDarkMode(!isDarkMode)} title={isDarkMode ? 'Light mode' : 'Dark mode'}>
          {isDarkMode ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Box>
      <List sx={{ p: 1 }}>
        {navItems.map((n) => (
          <ListItemButton
            key={n.to}
            component={RouterLink}
            to={n.to}
            sx={{ borderRadius: 1, mb: 0.5, '&:hover': { backgroundColor: 'rgba(11,132,255,0.06)' } }}
          >
            <ListItemText primary={n.label} />
          </ListItemButton>
        ))}
        <Box sx={{ mt: 1, px: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField size="small" label="1 USD =" value={rateInput} onChange={(e) => setRateInput(e.target.value)} onBlur={() => {
                const n = Number(rateInput) || null
                dispatch({ type: 'SET_EXCHANGE_RATE', payload: n })
              }} InputProps={{ endAdornment: (<>UZS</>) }} fullWidth />

              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel id="display-currency-label">Show As</InputLabel>
                <Select labelId="display-currency-label" label="Show As" value={displayCurrency} onChange={(e) => dispatch({ type: 'SET_UI', payload: { displayCurrency: e.target.value } })}>
                  <MenuItem value="UZS">UZS</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Button variant="outlined" startIcon={<LogoutIcon />} onClick={() => setAccountLockOpen(true)} fullWidth>
              Lock
            </Button>
        </Box>
      </List>
    </>
  )

  
  React.useEffect(() => {
    if (mobileOpen && isMobile) setMobileOpen(false)
    
  }, [location.pathname])

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ height: { xs: 56, md: 64 }, justifyContent: 'center' }}>
        <Toolbar sx={{ minHeight: { xs: 56, md: 64 } }}>
          <IconButton color="inherit" edge="start" sx={{ mr: 2, display: { md: 'none' } }} onClick={() => setMobileOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontSize: { xs: '1rem', md: '1.25rem' } }}>{t('appTitle')}</Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton color="inherit" onClick={() => {
              
              const uname = (user?.username || '').toString().toLowerCase()
              const acct = state.accounts?.find(a => (a.username || '').toString().toLowerCase() === uname)
              const isCoreAdmin = uname === 'hamdamjon' || uname === 'habibjon'
              if ((acct && acct.permissions && acct.permissions.manage_accounts) || isCoreAdmin) {
                console.debug('Layout: opening AccountManager for', uname, 'isCoreAdmin:', isCoreAdmin)
                setAccountManagerOpen(true)
              } else {
                console.debug('Layout: AccountManager open blocked for', uname, 'acct:', acct)
                
                setAccountSnackbarOpen(true)
              }
            }}>
              <AccountCircleIcon />
            </IconButton>
            <Typography sx={{ display: { xs: 'block', sm: 'block' }, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              {user?.username || 'Admin'}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {}
      <Drawer variant="permanent" sx={{ width: 220, display: { xs: 'none', md: 'block' }, [`& .MuiDrawer-paper`]: { width: 220, top: 64 } }} open>
        {drawer}
      </Drawer>

      {}
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { xs: 'block', md: 'none' } }}>
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 2 }, ml: { md: '220px' }, mt: { xs: '56px', md: '64px' }, overflowX: 'hidden' }}>
        <Box sx={{ width: '100%', maxWidth: { xs: '100%', md: '1200px' }, px: { xs: 0, sm: 1 }, pl: { md: 0 }, boxSizing: 'border-box' }}>
          {children}
        </Box>
      </Box>
      <AccountManager open={accountManagerOpen} onClose={() => setAccountManagerOpen(false)} />
      <AccountLock open={accountLockOpen} onClose={() => setAccountLockOpen(false)} />
      <Snackbar open={accountSnackbarOpen} autoHideDuration={3500} onClose={() => setAccountSnackbarOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setAccountSnackbarOpen(false)} severity="warning" sx={{ width: '100%' }}>
          Sizda akkauntlarni boshqarish ruxsati yo'q.
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default React.memo(Layout)
