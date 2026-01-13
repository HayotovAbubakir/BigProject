import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography } from '@mui/material'
import { useAuth } from '../hooks/useAuth'
import { loadAppState, saveAppState } from '../firebase/db'

const ESCALATION_THRESH = 4
const ESCALATION_DURATIONS = [1 * 60 * 1000, 5 * 60 * 1000]

async function readState(username) {
  try {
    const remote = await loadAppState(username)
    if (!remote || !remote.account_lock_state) return { consecutiveFailed: 0, escalationLevel: 0, lockoutUntil: null }
    const p = remote.account_lock_state
    return { consecutiveFailed: Number(p.consecutiveFailed) || 0, escalationLevel: Number(p.escalationLevel) || 0, lockoutUntil: p.lockoutUntil ? Number(p.lockoutUntil) : null }
  } catch (e) {
    console.error('AccountLock readState error:', e)
    return { consecutiveFailed: 0, escalationLevel: 0, lockoutUntil: null }
  }
}

async function writeState(username, state) {
  try {
    const remote = (await loadAppState(username)) || {}
    remote.account_lock_state = state
    await saveAppState(remote, username)
  } catch (e) {
    console.error('AccountLock writeState error:', e)
  }
}

async function clearState(username) {
  try {
    const remote = (await loadAppState(username)) || {}
    if (remote && remote.account_lock_state) delete remote.account_lock_state
    await saveAppState(remote, username)
  } catch (e) {
    console.error('AccountLock clearState error:', e)
  }
}

export default function AccountLock({ open, onClose }) {
  const { user, credentials, login } = useAuth()
  const currentUsername = user?.username || ''
  const [enteredUsername, setEnteredUsername] = React.useState(currentUsername)
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [stateVersion, setStateVersion] = React.useState(0) // bump to re-read storage
  const [lockedUntil, setLockedUntil] = React.useState(null)
  const [remainingSec, setRemainingSec] = React.useState(0) // used indirectly by interval

  React.useEffect(() => {
    // default entered username to current user when dialog opens
    if (open) setEnteredUsername(currentUsername)
  }, [currentUsername, open])

  React.useEffect(() => {
    if (!enteredUsername) return
    let mounted = true
    ;(async () => {
      const s = await readState(enteredUsername)
      if (!mounted) return
      setLockedUntil(s.lockoutUntil || null)
      if (s.lockoutUntil && Date.now() < s.lockoutUntil) {
        setRemainingSec(Math.ceil((s.lockoutUntil - Date.now()) / 1000))
      } else {
        setRemainingSec(0)
      }
    })()
    return () => { mounted = false }
  }, [enteredUsername, stateVersion, open])

  // live countdown
  React.useEffect(() => {
    let t
    if (lockedUntil && Date.now() < lockedUntil) {
      t = setInterval(() => {
        const rem = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
        setRemainingSec(rem)
        if (rem <= 0) {
          // expired - refresh state
          setLockedUntil(null)
          setStateVersion(v => v + 1)
          clearInterval(t)
        }
      }, 1000)
    }
    return () => clearInterval(t)
  }, [lockedUntil])

  React.useEffect(() => {
    if (!open) {
      setPassword('')
      setError('')
    }
  }, [open])

  const tryUnlock = () => {
    // operate on the entered username, not necessarily the currently logged-in user
    const target = (enteredUsername || '').toString()
    if (!target) {
      setError('Foydalanuvchi nomi kiriting')
      return
    }

    const sTarget = await readState(target)
    if (sTarget.lockoutUntil && Date.now() < sTarget.lockoutUntil) {
      setLockedUntil(sTarget.lockoutUntil)
      setRemainingSec(Math.ceil((sTarget.lockoutUntil - Date.now())/1000))
      setError(`Siz bloklangansiz. Kuting: ${Math.ceil((sTarget.lockoutUntil - Date.now())/1000)} sekund`)
      return
    }

    const expected = (credentials && credentials[target]) ? String(credentials[target]) : null
    if (expected && String(password) === expected) {
      // success: log in as this user
      try {
        const res = login({ username: target, password })
        if (res && res.ok) {
          clearState(target)
          setError('')
          setPassword('')
          onClose()
          return
        }
      } catch {
        // fallthrough to failure handling
      }
    }
    // wrong password
    const next = { ...sTarget }
    next.consecutiveFailed = (next.consecutiveFailed || 0) + 1
    if (next.consecutiveFailed >= ESCALATION_THRESH) {
      const idx = Math.min(next.escalationLevel || 0, ESCALATION_DURATIONS.length - 1)
      const dur = ESCALATION_DURATIONS[idx]
      next.lockoutUntil = Date.now() + dur
      next.escalationLevel = Math.min((next.escalationLevel || 0) + 1, ESCALATION_DURATIONS.length - 1)
      next.consecutiveFailed = 0
      setError(`Noto'g'ri parol. Hisob bloklandi: ${Math.ceil(dur/60000)} daqiqa`)
      // reflect in UI
      setLockedUntil(next.lockoutUntil)
      setRemainingSec(Math.ceil(dur / 1000))
    } else {
      const remaining = Math.max(ESCALATION_THRESH - next.consecutiveFailed, 0)
      setError(`Parol noto'g'ri. Bosqichga yetish uchun qolgan urinishlar: ${remaining}`)
    }
    await writeState(target, next)
    setStateVersion(v => v + 1)
    setPassword('')
  }

  return (
    <Dialog
      open={!!open}
      onClose={() => {}}
      disableEscapeKeyDown
      BackdropProps={{ style: { backgroundColor: 'rgba(0,0,0,0.96)' } }}
    >
      <DialogTitle>Hisobni bloklash / Qayta kirish</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>Hisobni bloklashdan keyin qayta kirish uchun parolni kiriting.</Typography>
        <TextField
          autoFocus
          fullWidth
          label="Foydalanuvchi nomi"
          value={enteredUsername}
          onChange={(e) => setEnteredUsername(e.target.value)}
          sx={{ mb: 1 }}
          disabled={!!lockedUntil && lockedUntil > Date.now()}
        />

        <TextField
          fullWidth
          type="password"
          label="Parol"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock() }}
          disabled={!!lockedUntil && lockedUntil > Date.now()}
        />
        {lockedUntil && lockedUntil > Date.now() ? (
          <Typography color="error" sx={{ mt: 1 }}>Bloklangan. Qolgan sekund: {remainingSec}</Typography>
        ) : (
          error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setPassword(''); setError(''); onClose() }}>Bekor</Button>
        <Button variant="contained" onClick={tryUnlock}>Kirish</Button>
      </DialogActions>
    </Dialog>
  )
}
