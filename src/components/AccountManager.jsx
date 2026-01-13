import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, List, ListItem, ListItemText, IconButton, Switch, FormControlLabel, Divider, Typography } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { useLocale } from '../context/LocaleContext'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'

export default function AccountManager({ open, onClose }) {
  const { state, dispatch } = useApp()
  const { user, hasPermission } = useAuth()
  const { t } = useLocale()
  const [adding, setAdding] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [selected, setSelected] = useState(null) 

  const canManageAccounts = hasPermission && hasPermission('manage_accounts')

  const accounts = state.accounts || []

  const { registerUser, deleteUser } = useAuth()

  const handleAdd = () => {
    if (!newUsername) return
    const username = newUsername.toLowerCase()
    if (accounts.find(a => a.username === username)) return
    const payload = { username, permissions: { credits_manage: false, wholesale_allowed: false, add_products: false, manage_accounts: false }, balance_uzs: 0 }
    
    dispatch({ type: 'ADD_ACCOUNT', payload, log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_ADD', detail: `Added account ${username}` } })
    
    try { registerUser(username, newPassword || username) } catch {  }
    setNewUsername('')
    setNewPassword('')
    setAdding(false)
  }

  const togglePermission = (username, key) => {
    const acc = accounts.find(a => a.username === username)
    if (!acc) return
    const updates = { permissions: { ...acc.permissions, [key]: !acc.permissions[key] } }
    
    dispatch({ type: 'EDIT_ACCOUNT', payload: { username: (username || '').toString().toLowerCase(), updates }, log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_EDIT', detail: `${username} ${key} -> ${!acc.permissions[key]}` } })
  }

  const handleDelete = (username) => {
    const uname = (username || '').toLowerCase()
    if (uname === 'hamdamjon' || uname === 'habibjon') {
      
      window.alert("Bu accountni o'chirish mumkin emas")
      return
    }
    ;(async () => {
      try {
        // attempt to delete credential row if available
        if (deleteUser) {
          const res = await deleteUser(uname)
          if (!res || !res.ok) {
            // still remove from app state, but warn
            console.warn('AccountManager: deleteUser failed', res && res.error)
          }
        }
      } catch (e) {
        console.debug('AccountManager: deleteUser threw', e)
      }
      dispatch({ type: 'DELETE_ACCOUNT', payload: { username: uname }, log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_DELETE', detail: `Deleted ${uname}` } })
    })()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('accounts') + ' ' + t('settings') || 'Account sozlamalari'}</DialogTitle>
      <DialogContent>
        {!canManageAccounts && (
          <Typography color="text.secondary">{t('permissionDenied') || 'Sizda ruxsat yo\'q'}</Typography>
        )}
        {canManageAccounts && (
          <>
            <Box sx={{ mb: 2 }}>
              <Button variant="contained" onClick={() => setAdding(s => !s)}>{adding ? t('cancel') : t('add_new_account') || 'Yangi account qo\'shish'}</Button>
              {adding && (
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField label={t('username') || 'Username'} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
                  <TextField label={t('password') || 'Password'} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <Button variant="outlined" onClick={handleAdd}>{t('add') || 'Qo\'sh'}</Button>
                </Box>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            <List>
              {accounts.map(a => {
                const targetIsAdmin = ['hamdamjon', 'habibjon'].includes((a.username || '').toLowerCase())
                return (
                  <ListItem key={a.username} onClick={() => setSelected(a.username)} sx={{ cursor: 'pointer' }} secondaryAction={(
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
                  <>
                    <Typography color="text.secondary" sx={{ mb: 1 }}>Bu accountga cheklov qo'yib bo'lmaydi</Typography>
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.credits_manage)} disabled />} label={t('credit_manage_permission') || 'Nasiya qo\'shish/tahrirlash'} />
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.wholesale_allowed)} disabled />} label={t('wholesale_permission') || 'Optom sotuv ruxsati'} />
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.add_products)} disabled />} label={t('add_product_permission') || 'Mahsulot qo\'shish ruxsati'} />
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.manage_accounts)} disabled />} label={t('manage_accounts_permission') || 'Boshqaruv paneliga kirish'} />
                  </>
                ) : (
                  <>
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.credits_manage)} onChange={() => togglePermission(selected, 'credits_manage')} />} label={t('credit_manage_permission') || 'Nasiya qo\'shish/tahrirlash'} />
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.wholesale_allowed)} onChange={() => togglePermission(selected, 'wholesale_allowed')} />} label={t('wholesale_permission') || 'Optom sotuv ruxsati'} />
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.add_products)} onChange={() => togglePermission(selected, 'add_products')} />} label={t('add_product_permission') || 'Mahsulot qo\'shish ruxsati'} />
                    <FormControlLabel control={<Switch checked={!!(accounts.find(x => x.username === selected)?.permissions?.manage_accounts)} onChange={() => togglePermission(selected, 'manage_accounts')} />} label={t('manage_accounts_permission') || 'Boshqaruv paneliga kirish'} />
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
