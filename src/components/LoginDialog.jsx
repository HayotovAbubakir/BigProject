import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Typography } from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function LoginDialog() {
  const { showLogin, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (showLogin) setError('')
  }, [showLogin])

  const submit = async () => {
    const res = login({ username, password })
    if (!res.ok) setError('Parol xato')
    else setError('')
  }

  const handleClose = (e, reason) => {
    // prevent closing on backdrop click or escape
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') return
  }

  return (
    <Dialog open={!!showLogin} disableEscapeKeyDown onClose={handleClose}>
      <DialogTitle>Kirish</DialogTitle>
      <DialogContent>
        <Typography variant="caption">Foydalanuvchi nomi kiriting (username)</Typography>
        <TextField fullWidth value={username} onChange={(e) => setUsername(e.target.value)} sx={{ mt: 1 }} />
  <Typography variant="caption" sx={{ mt: 1 }}>Parolni kiriting</Typography>
  <TextField fullWidth value={password} onChange={(e) => setPassword(e.target.value)} type="password" sx={{ mt: 1 }} />
        {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={submit} variant="contained">Kirish</Button>
      </DialogActions>
    </Dialog>
  )
}
