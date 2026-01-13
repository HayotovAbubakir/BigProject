import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Typography, Tabs, Tab, Box } from '@mui/material'
import { useLocale } from '../context/LocaleContext'
import { useAuth } from '../hooks/useAuth'

export default function LoginDialog() {
  const { showLogin, login, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { t } = useLocale()

  useEffect(() => {
    if (showLogin) {
      setError('')
    }
  }, [showLogin])

  const submitLogin = async () => {
    if (!username || !password) {
      setError(t('login_required') || 'Foydalanuvchi nomi va parol majburiy')
      return
    }
    setError('')
    // Perform login
    const res = await login({ username, password })
    if (!res.ok) setError(res.error || t('login_failed') || 'Login xato')
  }

  const handleClose = (e, reason) => {
    // prevent closing on backdrop click or escape
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') return
  }

  return (
    <Dialog
      open={!!showLogin}
      disableEscapeKeyDown
      onClose={handleClose}
      BackdropProps={{ style: { backgroundColor: 'rgba(0,0,0,0.96)' } }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {t('login') || 'Kirish'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption">{t('username_label') || 'Foydalanuvchi nomi'}</Typography>
          <TextField fullWidth value={username} onChange={(e) => setUsername(e.target.value)} sx={{ mt: 1 }} />
          <Typography variant="caption" sx={{ mt: 1 }}>{t('password_label') || 'Parol'}</Typography>
          <TextField fullWidth value={password} onChange={(e) => setPassword(e.target.value)} type="password" sx={{ mt: 1 }} />
          {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={submitLogin} variant="contained" disabled={loading}>{t('login') || 'Kirish'}</Button>
      </DialogActions>
    </Dialog>
  )
}
