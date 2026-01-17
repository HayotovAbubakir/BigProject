import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead, TableRow, TableCell, TableBody, IconButton, TextField, Box, Typography, Tooltip, Select, MenuItem, Alert, CircularProgress } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import RemoveIcon from '@mui/icons-material/Remove'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import ArchiveIcon from '@mui/icons-material/Archive'
import { v4 as uuidv4 } from 'uuid'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../context/LocaleContext'
import { useNotification } from '../context/NotificationContext'
import { supabase } from '/supabase/supabaseClient'

export default function CreditsDialog({ open, onClose, clientId, clientName }) {
  const { state, updateCredit, deleteCredit } = useApp()
  const { username } = useAuth()
  const { t } = useLocale()
  const { notify } = useNotification()
  const [deductState, setDeductState] = React.useState({ id: null, value: '' })
  const [filter, setFilter] = React.useState('active')
  const [deleteConfirm, setDeleteConfirm] = React.useState({ open: false, id: null, password: '', verifying: false })

  const activeCredits = (state.credits || [])
    .filter(c => (!c.completed || c.completed === false))
    .filter(c => !clientId || c.client_id === clientId)

  const completedCredits = (state.credits || [])
    .filter(c => c.completed === true)
    .filter(c => !clientId || c.client_id === clientId)

  const credits = filter === 'active' ? activeCredits : completedCredits

  const handleDeleteClick = (id) => {
    setDeleteConfirm({ open: true, id, password: '' })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.password) {
      notify('Xato', 'Parol kiritish kerak', 'error')
      return
    }

    setDeleteConfirm(s => ({ ...s, verifying: true }))

    try {
      // Parni tekshirish
      const { data, error } = await supabase
        .from('user_credentials')
        .select('password_hash')
        .eq('username', username)
        .maybeSingle()

      if (error || !data) {
        notify('Xato', 'Foydalanuvchi topilmadi', 'error')
        setDeleteConfirm(s => ({ ...s, verifying: false }))
        return
      }

      // Parol tekshirish (hozirgi simple: to'g'ri parolmi)
      if (data.password_hash !== deleteConfirm.password) {
        notify('Xato', 'Parol noto\'g\'ri! Nasiya o\'chirilmadi.', 'error')
        setDeleteConfirm(s => ({ ...s, verifying: false, password: '' }))
        return
      }

      // Parol to'g\'ri - nasiyani o\'chir
      const credit = (state.credits || []).find(c => c.id === deleteConfirm.id)
      if (!credit) return

      const logPayload = {
        id: uuidv4(),
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString(),
        user_name: username,
        action: 'CREDIT_DELETE',
        kind: 'credit',
        client_name: credit.clientName || credit.name || credit.client_name || credit.name,
        product_name: credit.product_name || credit.productName || null,
        product_id: credit.product_id || credit.productId || null,
        qty: credit.qty || credit.quantity || 1,
        unit_price: credit.unit_price || credit.unitPrice || credit.price || null,
        amount: credit.amount || ((credit.qty || 1) * (credit.unit_price || credit.price || 0)),
        currency: credit.currency || 'UZS',
        remaining: credit.remaining,
        detail: `Deleted credit ${deleteConfirm.id} for client ${credit.clientName || credit.name || credit.client_name || ''}` +
                (credit.product_name || credit.productName ? `: ${credit.qty || 1} x ${credit.product_name || credit.productName} @ ${credit.unit_price || credit.unitPrice || credit.price || ''} ${credit.currency || 'UZS'}` : `: amount ${credit.amount || ''} ${credit.currency || 'UZS'}`)
      }
      
      try {
        await deleteCredit(deleteConfirm.id, logPayload)
        notify('Muvaffaqiyat', 'Nasiya o\'chirildi', 'success')
        setDeleteConfirm({ open: false, id: null, password: '', verifying: false })
      } catch (err) {
        console.error('Delete error:', err)
        notify('Xato', 'Nasiyani o\'chirishda xatolik yuz berdi', 'error')
        setDeleteConfirm(s => ({ ...s, verifying: false }))
      }
    } catch (err) {
      console.error('Delete confirm error:', err)
      notify('Xato', 'Parol tekshirishda xatolik yuz berdi', 'error')
      setDeleteConfirm(s => ({ ...s, verifying: false }))
    }
  }

  const handleDeduct = async (id) => {
    const credit = (state.credits || []).find(c => c.id === id)
    if (!credit) return
    const amt = Number(deductState.value || 0)
    const currentRemaining = (credit.remaining !== undefined) ? credit.remaining : ((credit.amount || 0) - (credit.bosh_toluv || 0))
    
    if (!amt || amt <= 0) {
      return notify('Xato', 'To\'lov miqdori 0 dan katta bo\'lishi kerak', 'error')
    }
    
    if (amt > currentRemaining) {
      return notify('Xato', `Qolgan nasiya ${currentRemaining} ${credit.currency || 'UZS'} - bundan ko'proq minus qila olmaysiz!`, 'error')
    }
    
    const newRemaining = currentRemaining - amt
    const updates = { remaining: newRemaining }
    
    // Agar to'liq to'landi bo'lsa, avtomatik yakunla
    if (newRemaining <= 0) {
      updates.completed = true
    }

    const logPayload = {
      id: uuidv4(),
      user_name: username,
      action: 'CREDIT_DEDUCT',
      kind: 'CREDIT_DEDUCT',
      product_name: credit.clientName || credit.name,
      detail: `Deducted ${amt} from credit for ${credit.clientName || credit.name}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString(),
      amount: amt,
      currency: credit.currency,
    };
    
    try {
      await updateCredit(id, updates, logPayload)
      
      if (newRemaining <= 0) {
        notify('Muvaffaqiyat', 'Nasiya to\'liq to\'landi va yakunlandi', 'success')
      } else {
        notify('Muvaffaqiyat', `To'lov qabul qilindi. Qolgan: ${newRemaining} ${credit.currency || 'UZS'}`, 'success')
      }
      setDeductState({ id: null, value: '' })
    } catch (err) {
      console.error('Deduct error:', err)
      notify('Xato', 'To\'lovni saqlashda xatolik yuz berdi', 'error')
    }
  }

  const handleComplete = async (id) => {
    const credit = (state.credits || []).find(c => c.id === id)
    if (!credit) return
    const updates = { completed: true, remaining: 0 }

    const logPayload = {
      id: uuidv4(),
      user_name: username,
      action: 'CREDIT_COMPLETE',
      kind: 'CREDIT_COMPLETE',
      product_name: credit.clientName || credit.name,
      detail: `Completed credit for ${credit.clientName || credit.name}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString(),
      amount: credit.remaining,
      currency: credit.currency,
    };

    try {
      await updateCredit(id, updates, logPayload)
      notify('Muvaffaqiyat', 'Nasiya yakunlandi', 'success')
    } catch (err) {
      console.error('Complete error:', err)
      notify('Xato', 'Nasiyani yakunlashda xatolik yuz berdi', 'error')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{clientName ? `${clientName} — ${t('credits') || 'Credits'}` : (t('credits') || 'Credits')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} size="small">
            <MenuItem value="active">Aktiv</MenuItem>
            <MenuItem value="completed">Yakunlangan</MenuItem>
          </Select>
        </Box>
        {credits.length === 0 ? (
          <Typography sx={{ py: 2 }}>{filter === 'active' ? 'Aktiv nasiyalar yo\'q' : 'Yakunlangan nasiyalar yo\'q'}</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('client') || 'Client'}</TableCell>
                <TableCell>{t('type') || 'Type'}</TableCell>
                <TableCell>{t('amount') || 'Amount'}</TableCell>
                <TableCell>{t('initial_payment') || 'Initial Payment'}</TableCell>
                <TableCell>{t('remaining') || 'Remaining'}</TableCell>
                <TableCell>{t('date') || 'Date'}</TableCell>
                <TableCell align="right">{t('actions') || 'Actions'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {credits.map(c => {
                const remaining = (c.remaining !== undefined) ? c.remaining : ((c.amount || 0) - (c.bosh_toluv || 0));
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.clientName || c.name}</TableCell>
                    <TableCell>{c.credit_type === 'product' ? 'Mahsulot' : 'Pul'}</TableCell>
                    <TableCell>{(c.amount || 0) + ' ' + (c.currency || 'UZS')}</TableCell>
                    <TableCell>{(c.bosh_toluv || 0) + ' ' + (c.currency || 'UZS')}</TableCell>
                    <TableCell>{remaining + ' ' + (c.currency || 'UZS')}</TableCell>
                    <TableCell>{c.date || ''}</TableCell>
                    <TableCell align="right">
                      {filter === 'active' && (
                        <>
                          <Tooltip title={t('deduct') || 'Deduct'}>
                            <IconButton size="small" onClick={() => setDeductState({ id: c.id, value: '' })}><RemoveIcon /></IconButton>
                          </Tooltip>
                          <Tooltip title={t('complete') || 'Complete'}>
                            <IconButton size="small" onClick={() => handleComplete(c.id)}><DoneAllIcon /></IconButton>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip title={t('delete') || 'Delete'}>
                        <IconButton size="small" color="error" onClick={() => handleDeleteClick(c.id)}><DeleteIcon /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {deductState.id && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
            <TextField label={t('amount') || 'Amount'} value={deductState.value} onChange={(e) => setDeductState(s => ({ ...s, value: e.target.value }))} />
            <Button variant="contained" onClick={() => handleDeduct(deductState.id)}>{t('deduct') || 'Deduct'}</Button>
            <Button onClick={() => setDeductState({ id: null, value: '' })}>{t('cancel') || 'Cancel'}</Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('close') || 'Close'}</Button>
      </DialogActions>

      {/* Password Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: null, password: '', verifying: false })}>
        <DialogTitle>{username} ning paroli</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Nasiyani o'chirish uchun o'zingizning (<strong>{username}</strong>) parolini kiriting!
          </Alert>
          <TextField
            autoFocus
            margin="dense"
            label="Parol"
            type="password"
            fullWidth
            value={deleteConfirm.password}
            onChange={(e) => setDeleteConfirm(s => ({ ...s, password: e.target.value }))}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !deleteConfirm.verifying) {
                handleDeleteConfirm()
              }
            }}
            disabled={deleteConfirm.verifying}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, id: null, password: '', verifying: false })} disabled={deleteConfirm.verifying}>Bekor</Button>
          <Button 
            onClick={handleDeleteConfirm} 
            variant="contained" 
            color="error"
            disabled={deleteConfirm.verifying}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            {deleteConfirm.verifying && <CircularProgress size={20} />}
            O'chirish
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}
