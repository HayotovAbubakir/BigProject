import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, List, ListItem, ListItemText, IconButton, Switch, FormControlLabel, Divider, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { v4 as uuidv4 } from 'uuid'

export default function AccountManager({ open, onClose }) {
  const { state, dispatch } = useApp()
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [selected, setSelected] = useState(null) // username

  const isAdmin = (user?.username || '').toLowerCase() === 'hamdamjon' || (user?.username || '').toLowerCase() === 'habibjon'

  const accounts = state.accounts || []

  const { registerUser } = useAuth()

  const handleAdd = () => {
    if (!newUsername) return
    const username = newUsername.toLowerCase()
    if (accounts.find(a => a.username === username)) return
    const payload = { username, permissions: { credits_manage: false, wholesale_allowed: false } }
    // persist account in app state
    dispatch({ type: 'ADD_ACCOUNT', payload, log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_ADD', detail: `Added account ${username}` } })
    // register credentials (store password locally) so the new account can login
    try { registerUser(username, newPassword || username) } catch { /* ignore */ }
    setNewUsername('')
    setNewPassword('')
    setAdding(false)
  }

  const togglePermission = (username, key) => {
    const acc = accounts.find(a => a.username === username)
    if (!acc) return
    const updates = { permissions: { ...acc.permissions, [key]: !acc.permissions[key] } }
    // Reducer expects updates inside payload.updates
    dispatch({ type: 'EDIT_ACCOUNT', payload: { username, updates }, log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_EDIT', detail: `${username} ${key} -> ${!acc.permissions[key]}` } })
  }

  const handleDelete = (username) => {
    const uname = (username || '').toLowerCase()
    if (uname === 'hamdamjon' || uname === 'habibjon') {
      // prevent deleting core admins
      window.alert("Bu accountni o'chirish mumkin emas")
      return
    }
    dispatch({ type: 'DELETE_ACCOUNT', payload: { username }, log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_DELETE', detail: `Deleted ${username}` } })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Account sozlamalari</DialogTitle>
      <DialogContent>
        {!isAdmin && (
          <Typography color="text.secondary">Sizda ruxsat yo'q</Typography>
        )}
        {isAdmin && (
          <>
            <Box sx={{ mb: 2 }}>
              <Button variant="contained" onClick={() => setAdding(s => !s)}>{adding ? 'Bekor' : 'Yangi account qo\'shish'}</Button>
              {adding && (
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField label="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                  <TextField label="Parol" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <Button variant="outlined" onClick={handleAdd}>Qo'sh</Button>
                </Box>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            <List>
              {accounts.map(a => {
                const targetIsAdmin = ['hamdamjon', 'habibjon'].includes((a.username || '').toLowerCase())
                return (
                  <ListItem key={a.username} secondaryAction={(
                    <Box>
                      <IconButton onClick={() => !targetIsAdmin && setSelected(a.username)} aria-label="edit" disabled={targetIsAdmin}><EditIcon /></IconButton>
                      <IconButton onClick={() => !targetIsAdmin && handleDelete(a.username)} aria-label="delete" disabled={targetIsAdmin}><DeleteIcon /></IconButton>
                    </Box>
                  )}>
                    <ListItemText primary={a.username} secondary={`@${a.username}`} />
                  </ListItem>
                )
              })}
            </List>

            {selected && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontWeight: 700 }}>{selected}</Typography>
                {(['hamdamjon', 'habibjon'].includes((selected || '').toLowerCase())) ? (
                  <Typography color="text.secondary">Bu accountga cheklov qo'yib bo'lmaydi</Typography>
                ) : (
                  <>
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.credits_manage)} onChange={() => togglePermission(selected, 'credits_manage')} />} label="Nasiya qo'shish/tahrirlash" />
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.wholesale_allowed)} onChange={() => togglePermission(selected, 'wholesale_allowed')} />} label="Optom sotuv ruxsati" />
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.add_products)} onChange={() => togglePermission(selected, 'add_products')} />} label="Mahsulot qo'shish ruxsati" />
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.manage_accounts)} onChange={() => togglePermission(selected, 'manage_accounts')} />} label="Boshqaruv paneliga kirish" />
                  </>
                )}
                <Box sx={{ mt: 1 }}>
                  <Button variant="outlined" onClick={() => setSelected(null)}>Yopish</Button>
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Yopish</Button>
      </DialogActions>
    </Dialog>
  )
}
