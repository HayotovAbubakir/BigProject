import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Typography, Box, Alert } from '@mui/material'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { useLocale } from '../context/LocaleContext'
import { useAuth } from '../hooks/useAuth'

export default function LoginDialog() {
  const { showLogin, login, loading, authNotice } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [needsChallenge, setNeedsChallenge] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const { t } = useLocale()
  const siteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY

  useEffect(() => {
    if (showLogin) {
      setError('')
      setPassword('')
      setCaptchaToken('')
      setNeedsChallenge(false)
    }
  }, [showLogin])

  const submitLogin = async () => {
    if (!username || !password) {
      setError(t('login_required') || 'Foydalanuvchi nomi va parol majburiy')
      return
    }
    if (needsChallenge && !captchaToken) {
      setError('Please complete the verification challenge.')
      return
    }
    setError('')
    // Perform login
    const res = await login({ username, password, captchaToken })
    if (!res.ok) {
      if (res.challengeRequired) {
        setNeedsChallenge(true)
      }
      if (res.lockUntil) {
        const untilText = new Date(res.lockUntil).toLocaleTimeString()
        setError(`Account temporarily locked until ${untilText}`)
        return
      }
      setError(res.error || t('login_failed') || 'Login xato')
      return
    }
    setNeedsChallenge(false)
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
          {authNotice && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {authNotice}
            </Alert>
          )}
          <Typography variant="caption">{t('username_label') || 'Foydalanuvchi nomi'}</Typography>
          <TextField fullWidth value={username} onChange={(e) => setUsername(e.target.value)} sx={{ mt: 1 }} />
          <Typography variant="caption" sx={{ mt: 1 }}>{t('password_label') || 'Parol'}</Typography>
          <TextField fullWidth value={password} onChange={(e) => setPassword(e.target.value)} type="password" sx={{ mt: 1 }} />
          {needsChallenge && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption">Verification required</Typography>
              {siteKey ? (
                <HCaptcha
                  sitekey={siteKey}
                  onVerify={(token) => setCaptchaToken(token || '')}
                  onExpire={() => setCaptchaToken('')}
                />
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  CAPTCHA is required but not configured. Set VITE_HCAPTCHA_SITE_KEY.
                </Alert>
              )}
            </Box>
          )}
          {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={submitLogin} variant="contained" disabled={loading}>{t('login') || 'Kirish'}</Button>
      </DialogActions>
    </Dialog>
  )
}
