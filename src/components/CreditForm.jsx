import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, MenuItem, Box, InputAdornment } from '@mui/material'
import useExchangeRate from '../hooks/useExchangeRate'
import { v4 as uuidv4 } from 'uuid'

export default function CreditForm({ open, onClose, onSubmit, initial }) {
  const [form, setForm] = useState({ name: '', date: '', amount: 0, currency: 'UZS', type: 'olingan', note: '' })
  const { rate: usdToUzs } = useExchangeRate()

  useEffect(() => {
    if (initial) setForm(initial)
    else setForm({ name: '', date: '', amount: 0, currency: 'UZS', type: 'olingan', note: '' })
    
  }, [initial])

  const handle = (k) => (evt) => setForm({ ...form, [k]: evt.target.value })

  const submit = () => {
    const payload = { id: initial?.id || uuidv4(), ...form }
    
    
    if (payload.currency === 'USD') {
      
      payload.amount = Number(payload.amount) || 0
      if (payload.amount_uzs !== undefined) delete payload.amount_uzs
    } else {
      payload.amount = Number(payload.amount) || 0
      payload.amount_uzs = Math.round(payload.amount)
    }
    onSubmit(payload)
    onClose()
  }

  

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: { xs: '1.05rem', md: '1.25rem' } }}>{initial ? 'Nasiya tahrirlash' : 'Yangi nasiya'}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField label="Kim" fullWidth margin="dense" value={form.name} onChange={handle('name')} />
        <TextField label="Sana" fullWidth margin="dense" value={form.date} onChange={handle('date')} />
        <TextField label="Miqdor" fullWidth type="number" margin="dense" value={form.amount} onChange={handle('amount')} />
        <TextField select label="Valyuta" fullWidth margin="dense" value={form.currency} onChange={handle('currency')}>
          <MenuItem value="UZS">UZS</MenuItem>
          <MenuItem value="USD">USD</MenuItem>
        </TextField>
        {form.currency === 'USD' ? (
          <Box sx={{ mt: 1 }}>
            <TextField label="Jami (UZS)" type="text" fullWidth margin="dense" value={form.amount && usdToUzs ? Math.round(Number(form.amount) * usdToUzs) : ''} disabled />
          </Box>
        ) : null}
        <TextField select label="Turi" fullWidth margin="dense" value={form.type} onChange={handle('type')}>
          <MenuItem value="olingan">Olingan</MenuItem>
          <MenuItem value="berilgan">Berilgan</MenuItem>
        </TextField>
        <TextField label="Izoh" fullWidth margin="dense" value={form.note} onChange={handle('note')} />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ minWidth: 100 }}>Bekor qilish</Button>
        <Button variant="contained" onClick={submit} sx={{ minWidth: 120 }}>Saqlash</Button>
      </DialogActions>
    </Dialog>
  )
}
