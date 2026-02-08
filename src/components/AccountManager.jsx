import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, List, ListItem, ListItemText, IconButton, Switch, FormControlLabel, Divider, Typography, Checkbox } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { useLocale } from '../context/LocaleContext'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'
import { validatePassword } from '../context/AuthContext'
import { DEFAULT_PRODUCT_CATEGORIES, mergeCategories, normalizeCategory } from '../utils/productCategories'

export default function AccountManager({ open, onClose }) {
  const { state, dispatch } = useApp()
  const { user, registerUser, deleteUser } = useAuth()
  const { t } = useLocale()
  const [adding, setAdding] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newAccountRestricted, setNewAccountRestricted] = useState(false)
  const [selected, setSelected] = useState(null) 
  const [newCategory, setNewCategory] = useState('')

  // Reset form state when dialog opens
  React.useEffect(() => {
    if (open) {
      setAdding(false)
      setSelected(null)
      setNewUsername('')
      setNewPassword('')
      setNewAccountRestricted(false)
      setNewCategory('')
    }
  }, [open])

  const currentRole = (user?.role || '').toLowerCase()
  const isCurrentDeveloper = currentRole === 'developer'
  const isCurrentAdmin = currentRole === 'admin'

  // Only developers and admins can manage accounts
  const canManageAccounts = isCurrentDeveloper || isCurrentAdmin

  const accounts = state.accounts || []
  const categoryFilters = mergeCategories(state.ui?.productCategories || [], DEFAULT_PRODUCT_CATEGORIES)

  const normalizeUsername = (value) => (value || '').toString().toLowerCase()
  const isDeveloperAccount = (accOrName) => {
    const uname = normalizeUsername(typeof accOrName === 'string' ? accOrName : accOrName?.username)
    const role = (typeof accOrName === 'object' && accOrName?.role) ? accOrName.role.toString().toLowerCase() : ''
    return role === 'developer' || uname === 'developer'
  }
  const isAdminAccount = (accOrName) => {
    const uname = normalizeUsername(typeof accOrName === 'string' ? accOrName : accOrName?.username)
    const role = (typeof accOrName === 'object' && accOrName?.role) ? accOrName.role.toString().toLowerCase() : ''
    return role === 'admin' || uname === 'hamdamjon' || uname === 'habibjon'
  }

  const visibleAccounts = accounts.filter(a => !isDeveloperAccount(a))
  const selectedAccount = accounts.find(a => normalizeUsername(a?.username) === normalizeUsername(selected))

  React.useEffect(() => {
    if (selectedAccount && isDeveloperAccount(selectedAccount)) {
      setSelected(null)
    }
  }, [selectedAccount, isDeveloperAccount])

  const handleAdd = async () => {
    if (!newUsername) return
    if (!newPassword) {
      window.alert(t('password_min_length') || 'Password is required')
      return
    }
    const policy = validatePassword(newPassword)
    if (!policy.ok) {
      window.alert(policy.errors.join('. '))
      return
    }
    const username = newUsername.toLowerCase()
    if (accounts.find(a => a.username === username)) {
      window.alert(t('account_exists') || 'Bunday akkaunt allaqachon mavjud')
      return
    }
    const payload = { 
      username, 
      permissions: { 
        credits_manage: true, 
        wholesale_allowed: true, 
        add_products: true, 
        manage_accounts: false,
        new_account_restriction: newAccountRestricted
      }, 
      balance_uzs: 0 
    }
    
    dispatch({ type: 'ADD_ACCOUNT', payload, log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_ADD', detail: `Added account ${username}` } })
    
    try {
      const res = await registerUser(username, newPassword, 'user', payload.permissions)
      if (!res || !res.ok) {
        window.alert((res && res.error) || t('add_account_failed') || 'Akkaunt qo\'shish xatosi')
        return
      }
      window.alert(t('account_added') || 'Akkaunt muvaffaqiyatli qo\'shildi')
      setNewUsername('')
      setNewPassword('')
      setNewAccountRestricted(false)
      setAdding(false)
    } catch (err) {
      console.error('handleAdd error:', err)
      window.alert(err && err.message || t('add_account_failed') || 'Akkaunt qo\'shish xatosi')
    }
  }

  const togglePermission = (username, key) => {
    if (!canManageAccounts) {
      window.alert("Bu bo'lim faqat admin va developerlar uchun")
      return
    }
    const acc = accounts.find(a => a.username === username)
    if (!acc) return

    const targetIsDeveloper = isDeveloperAccount(acc)
    const targetIsAdmin = isAdminAccount(acc)

    if (targetIsDeveloper) {
      window.alert("Developer akkayunti cheklanmaydi")
      return
    }

    if (targetIsAdmin && !isCurrentDeveloper) {
      window.alert("Admin akkayuntini faqat developer cheklashi mumkin")
      return
    }
    
    // Prevent restricted accounts from disabling their own restrictions
    const currentUserName = (user?.username || '').toLowerCase()
    const targetUserName = (username || '').toLowerCase()
    if (currentUserName === targetUserName && key === 'new_account_restriction' && acc.permissions?.new_account_restriction) {
      window.alert("O'zingizga qo'yilgan cheklovni o'chira olmaysiz")
      return
    }
    
    const currentPermissions = acc.permissions || {}
    const updates = { permissions: { ...currentPermissions, [key]: !currentPermissions[key] } }

    dispatch({
      type: 'EDIT_ACCOUNT',
      payload: {
        username: (username || '').toString().toLowerCase(),
        updates,
        actorRole: currentRole
      },
      log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_EDIT', detail: `${username} ${key} -> ${!currentPermissions[key]}` }
    })
  }

  const handleDelete = (username) => {
    const uname = (username || '').toLowerCase()
    const targetAcc = accounts.find(a => (a.username || '').toLowerCase() === uname)
    const targetRole = (targetAcc?.role || '').toLowerCase()
    if (uname === 'developer' || targetRole === 'developer') {
      window.alert("Developer accountini o'chirib bo'lmaydi")
      return
    }
    if ((uname === 'hamdamjon' || uname === 'habibjon' || targetRole === 'admin') && !isCurrentDeveloper) {
      window.alert("Admin accountini faqat developer o'chira oladi")
      return
    }
    ;(async () => {
      try {
        // attempt to delete credential row if available
        if (deleteUser) {
          const res = await deleteUser(uname)
          if (res && res.success) {
            dispatch({ type: 'DELETE_ACCOUNT', payload: { username: uname, actorRole: currentRole }, log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_DELETE', detail: `Deleted ${uname}` } })
            window.alert(t('account_deleted') || 'Akkaunt muvaffaqiyatli o\'chirildi')
          } else {
            window.alert((res && res.error) || t('delete_account_failed') || 'Akkauntni o\'chirish xatosi')
          }
        } else {
          // If no deleteUser, still allow state removal for backwards compatibility
          dispatch({ type: 'DELETE_ACCOUNT', payload: { username: uname, actorRole: currentRole }, log: { ts: Date.now(), user: user?.username, action: 'ACCOUNT_DELETE', detail: `Deleted ${uname}` } })
        }
      } catch (e) {
        console.debug('AccountManager: deleteUser threw', e)
        window.alert('Akkauntni o\'chirishda xatolik yuz berdi')
      }
    })()
  }

  const handleAddCategory = () => {
    if (!canManageAccounts) {
      window.alert("Bu bo'lim faqat admin va developerlar uchun")
      return
    }
    const normalized = normalizeCategory(newCategory)
    if (!normalized) return
    if (categoryFilters.includes(normalized)) {
      window.alert('Bunday filter mavjud')
      return
    }
    const next = mergeCategories(categoryFilters, normalized)
    dispatch({ type: 'SET_UI', payload: { productCategories: next } })
    setNewCategory('')
  }

  const handleRemoveCategory = (category) => {
    if (!canManageAccounts) return
    const normalized = normalizeCategory(category)
    if (DEFAULT_PRODUCT_CATEGORIES.includes(normalized)) {
      window.alert('Asosiy filterlarni o‘chira olmaysiz')
      return
    }
    const next = categoryFilters.filter(c => c !== normalized)
    dispatch({ type: 'SET_UI', payload: { productCategories: next } })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('accounts') + ' ' + t('settings') || 'Account sozlamalari'}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Button variant="contained" onClick={() => setAdding(s => !s)}>{adding ? t('cancel') : t('add_new_account') || 'Yangi account qo\'shish'}</Button>
          {adding && (
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'flex-start' }}>
              <TextField label={t('username') || 'Username'} value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              <TextField
                label={t('password') || 'Password'}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Min 10 chars, upper/lower/number/symbol"
              />
              <FormControlLabel 
                control={<Checkbox checked={newAccountRestricted} onChange={(e) => setNewAccountRestricted(e.target.checked)} />} 
                label={t('restrict_access') || 'Cheklovlarni yoniq qil'} 
                sx={{ mt: 1 }}
              />
              <Button variant="outlined" onClick={handleAdd}>{t('add') || 'Qo\'sh'}</Button>
            </Box>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        <List>
          {visibleAccounts.map(a => (
            <ListItem key={a.username} onClick={() => setSelected(a.username)} sx={{ cursor: 'pointer' }} secondaryAction={(
              <Box>
                <IconButton onClick={() => setSelected(a.username)} aria-label="edit"><EditIcon /></IconButton>
                <IconButton onClick={() => handleDelete(a.username)} aria-label="delete"><DeleteIcon /></IconButton>
              </Box>
            )}>
              <ListItemText primary={a.username} secondary={`@${a.username}`} />
            </ListItem>
          ))}
        </List>

        {selected && selectedAccount && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>{selected}</Typography>
            {!isAdminAccount(selectedAccount) ? (
              <>
                <FormControlLabel control={<Switch checked={!!(selectedAccount?.permissions?.credits_manage)} onChange={() => togglePermission(selected, 'credits_manage')} />} label={t('credit_manage_permission') || 'Nasiya qo\'shish/tahrirlash'} />
                <FormControlLabel control={<Switch checked={!!(selectedAccount?.permissions?.wholesale_allowed)} onChange={() => togglePermission(selected, 'wholesale_allowed')} />} label={t('wholesale_permission') || 'Optom sotuv ruxsati'} />
                <FormControlLabel control={<Switch checked={!!(selectedAccount?.permissions?.add_products)} onChange={() => togglePermission(selected, 'add_products')} />} label={t('add_product_permission') || 'Mahsulot qo\'shish ruxsati'} />
                <FormControlLabel control={<Switch checked={!!(selectedAccount?.permissions?.manage_accounts)} onChange={() => togglePermission(selected, 'manage_accounts')} />} label={t('manage_accounts_permission') || 'Boshqaruv paneliga kirish'} />
                <FormControlLabel control={<Switch checked={!!(selectedAccount?.permissions?.new_account_restriction)} onChange={() => togglePermission(selected, 'new_account_restriction')} />} label={t('restrict_access') || 'Cheklovlarni yoniq qil'} />
              </>
            ) : (
              <>
                {isCurrentDeveloper ? (
                  <FormControlLabel control={<Switch checked={!!(selectedAccount?.permissions?.new_account_restriction)} onChange={() => togglePermission(selected, 'new_account_restriction')} />} label={t('restrict_access') || 'Cheklovlarni yoniq qil'} />
                ) : (
                  <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Admin akkayuntini faqat developer o'zgartira oladi</Typography>
                )}
              </>
            )}
            <Box sx={{ mt: 1 }}>
              <Button variant="outlined" onClick={() => setSelected(null)}>Yopish</Button>
            </Box>
          </Box>
        )}

        {canManageAccounts && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Filterlar (Kategoriyalar)</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, mb: 1 }}>
              <TextField
                label="Yangi filter"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                size="small"
              />
              <Button variant="outlined" onClick={handleAddCategory}>Qo'shish</Button>
            </Box>
            <List dense>
              {categoryFilters.map(cat => (
                <ListItem key={cat} secondaryAction={(
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleRemoveCategory(cat)}
                    disabled={DEFAULT_PRODUCT_CATEGORIES.includes(cat)}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}>
                  <ListItemText primary={cat} secondary={DEFAULT_PRODUCT_CATEGORIES.includes(cat) ? 'Asosiy filter' : null} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Yopish</Button>
      </DialogActions>
    </Dialog>
  )
}
