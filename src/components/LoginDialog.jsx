import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Typography, Tabs, Tab, Box } from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function LoginDialog() {
  const { showLogin, login, registerUser, loading, isAdmin } = useAuth()
  const [tab, setTab] = useState(0) // 0 = login, 1 = register (only for admins)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (showLogin) {
      setError('')
      setSuccessMessage('')
      setTab(0) // Reset to login tab
    }
  }, [showLogin])

  const handleTabChange = (event, newValue) => {
    setTab(newValue)
    setError('')
    setSuccessMessage('')
  }

  const submitLogin = async () => {
    if (!username || !password) {
      setError('Foydalanuvchi nomi va parol majburiy')
      return
    }
    setError('')
    setSuccessMessage('')
    const res = await login({ username, password })
    if (!res.ok) setError(res.error || 'Login xato')
  }

  const submitRegister = async () => {
    if (!newUsername || !newPassword) {
      setError('Foydalanuvchi nomi va parol majburiy')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Parollar mos kelmaydi')
      return
    }
    if (newPassword.length < 4) {
      setError('Parol kamida 4 ta belgidan iborat bo\'lishi kerak')
      return
    }
    setError('')
    setSuccessMessage('')
    const res = await registerUser(newUsername, newPassword)
    if (!res.ok) {
      setError(res.error || 'Ro\'yxatdan o\'tish xato')
    } else {
      setSuccessMessage('Foydalanuvchi muvaffaqiyatli qo\'shildi!')
      setNewUsername('')
      setNewPassword('')
      setConfirmPassword('')
    }
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
        <Tabs value={tab} onChange={handleTabChange} aria-label="auth tabs">
          <Tab label="Kirish" />
          {isAdmin && <Tab label="Foydalanuvchi qo'shish" />}
        </Tabs>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {tab === 0 ? (
            // Login Tab
            <>
              <Typography variant="caption">Foydalanuvchi nomi</Typography>
              <TextField
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" sx={{ mt: 1 }}>Parol</Typography>
              <TextField
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                sx={{ mt: 1 }}
              />
            </>
          ) : (
            // Register Tab (only for admins)
            <>
              <Typography variant="caption">Yangi foydalanuvchi nomi</Typography>
              <TextField
                fullWidth
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" sx={{ mt: 1 }}>Parol</Typography>
              <TextField
                fullWidth
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" sx={{ mt: 1 }}>Parolni tasdiqlang</Typography>
              <TextField
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                sx={{ mt: 1 }}
              />
            </>
          )}
          {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
          {successMessage && <Typography color="success.main" sx={{ mt: 1 }}>{successMessage}</Typography>}
        </Box>
      </DialogContent>
      <DialogActions>
        {tab === 0 ? (
          <Button onClick={submitLogin} variant="contained" disabled={loading}>
            Kirish
          </Button>
        ) : (
          <Button onClick={submitRegister} variant="contained" disabled={loading}>
            Qo'shish
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
