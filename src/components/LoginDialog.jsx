import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Typography, Box, Alert, IconButton, useTheme } from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
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
  const [showPassword, setShowPassword] = useState(false)
  const { t } = useLocale()
  const theme = useTheme()
  const siteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY
  const isDark = theme.palette.mode === 'dark'
  const inputColors = {
    bg: isDark ? '#2a2d31' : '#f9fafb',
    text: isDark ? '#ffffff' : '#111827',
    placeholder: isDark ? '#6b7280' : '#9ca3af',
    border: isDark ? '#374151' : '#e5e7eb'
  }

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
      PaperProps={{
        sx: {
          position: 'relative',
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(26,29,33,0.7)' : 'rgba(255,255,255,0.75)',
          color: inputColors.text,
          borderRadius: 2,
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(16px)'
        }
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: 'linear-gradient(130deg, rgba(15,23,42,0.95), rgba(30,27,75,0.85), rgba(15,23,42,0.9))',
          backgroundSize: '200% 200%',
          animation: 'gradientShift 12s ease infinite',
          '@keyframes gradientShift': {
            '0%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
            '100%': { backgroundPosition: '0% 50%' }
          }
        }}
      />
      <DialogTitle>
        {t('login') || 'Kirish'}
      </DialogTitle>
      <DialogContent sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ mt: 2, position: 'relative', zIndex: 1 }}>
          {authNotice && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {authNotice}
            </Alert>
          )}
          <Typography variant="caption">{t('username_label') || 'Foydalanuvchi nomi'}</Typography>
          <TextField
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{ mt: 1 }}
            InputProps={{
              sx: {
                backgroundColor: inputColors.bg,
                color: inputColors.text,
                '& .MuiInputBase-input::placeholder': { color: inputColors.placeholder },
                '& fieldset': { borderColor: inputColors.border },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                '&.Mui-focused': { boxShadow: '0 0 0 2px rgba(59,130,246,0.35)' }
              }
            }}
            placeholder={t('username_label') || 'Foydalanuvchi nomi'}
          />
          <Typography variant="caption" sx={{ mt: 1 }}>{t('password_label') || 'Parol'}</Typography>
          <Box sx={{ position: 'relative', mt: 1 }}>
            <TextField
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              InputProps={{
                sx: {
                  backgroundColor: inputColors.bg,
                  color: inputColors.text,
                  '& .MuiInputBase-input::placeholder': { color: inputColors.placeholder },
                  '& fieldset': { borderColor: inputColors.border },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                  '&.Mui-focused': { boxShadow: '0 0 0 2px rgba(59,130,246,0.35)' }
                }
              }}
              placeholder={t('password_label') || 'Parol'}
            />
            <IconButton
              aria-label="toggle password visibility"
              onClick={() => setShowPassword((p) => !p)}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: inputColors.placeholder,
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'none',
                '&:hover': { backgroundColor: 'transparent', color: inputColors.text }
              }}
            >
              {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </Box>
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
        <Button
          onClick={submitLogin}
          variant="contained"
          disabled={loading}
          sx={{
            bgcolor: 'primary.main',
            color: '#fff',
            px: 3,
            boxShadow: '0 10px 24px rgba(59,130,246,0.35)',
            '&:hover': { bgcolor: 'primary.dark' }
          }}
        >
          {t('login') || 'Kirish'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
