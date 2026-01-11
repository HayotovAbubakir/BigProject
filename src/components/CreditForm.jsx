import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, MenuItem, Box, Typography } from '@mui/material'
import useExchangeRate from '../hooks/useExchangeRate'
import { v4 as uuidv4 } from 'uuid'
import { useLocale } from '../context/LocaleContext'
import { formatMoney } from '../utils/format'
import NumberField from './NumberField'

export default function CreditForm({ open, onClose, onSubmit, initial }) {
  const [form, setForm] = useState({ name: '', date: '', amount: 0, currency: 'UZS', type: 'olingan', note: '' })
  const [isPayment, setIsPayment] = useState(false)
  const { rate: usdToUzs } = useExchangeRate()
  const { t } = useLocale()

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

  const remainingDisplay = initial ? (initial.amount - (initial.bosh_toluv || 0)) : 0

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: { xs: '1.05rem', md: '1.25rem' } }}>
        {isPayment ? t('credit_receive_payment') : (initial ? t('credit_edit') : t('credit_new'))}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {initial && (
          <Box sx={{ mb: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="body2" color="textSecondary">{t('total_received')}: {formatMoney(initial.amount)} {initial.currency}</Typography>
            {(initial.bosh_toluv || initial.downPayment) > 0 && <Typography variant="body2" color="textSecondary">{t('boshToluv')}: {formatMoney(initial.bosh_toluv || initial.downPayment)} {initial.currency}{(initial.down_payment_note) ? ` (${initial.down_payment_note})` : ''}</Typography>}
            <Typography variant="body2" color="textSecondary">{t('paid')}: {formatMoney(initial.paid || 0)} {initial.currency}</Typography>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mt: 0.5 }}>{t('remaining')}: {formatMoney(remainingDisplay)} {initial.currency}</Typography>
          </Box>
        )}
        
        {isPayment ? (
          <>
            <Typography variant="body2" sx={{ mb: 1 }}>{t('how_much_to_pay')}</Typography>
            <NumberField label={t('payment')} fullWidth margin="dense" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} inputProps={{ max: remainingDisplay }} />
            <TextField label={t('date')} fullWidth margin="dense" value={form.date} onChange={handle('date')} />
          </>
        ) : (
          <>
            <TextField label={t('who')} fullWidth margin="dense" value={form.name} onChange={handle('name')} />
            <TextField label={t('productName')} fullWidth margin="dense" value={form.product_name} onChange={handle('product_name')} />
            <NumberField label={t('qty')} fullWidth margin="dense" value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} />
            <NumberField label={t('price')} fullWidth margin="dense" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            <TextField label={t('date')} fullWidth margin="dense" value={form.date} onChange={handle('date')} />
            <Typography variant="body2" sx={{ mt: 1 }}>{t('total_amount')}: {formatMoney((Number(form.qty) || 1) * (Number(form.price) || 0))} {form.currency}</Typography>
            <Box sx={{ border: '1px solid #ccc', borderRadius: 1, p: 2, mt: 2 }}>
              <NumberField label={t('boshToluv')} fullWidth margin="dense" value={form.bosh_toluv} onChange={(v) => setForm({ ...form, bosh_toluv: v })} />
              <TextField label={t('down_payment_note')} fullWidth margin="dense" value={form.down_payment_note} onChange={handle('down_payment_note')} />
            </Box>
            <TextField select label={t('currency')} fullWidth margin="dense" value={form.currency} onChange={handle('currency')}>
              <MenuItem value="UZS">UZS</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
            </TextField>
            {form.currency === 'USD' ? (
              <Box sx={{ mt: 1 }}>
                <TextField label="Jami (UZS)" type="text" fullWidth margin="dense" value={form.amount && usdToUzs ? Math.round(Number(form.amount) * usdToUzs) : ''} disabled />
              </Box>
            ) : null}
            <TextField select label={t('type')} fullWidth margin="dense" value={form.type} onChange={handle('type')}>
              <MenuItem value="olingan">{t('creditDirectionOlingan')}</MenuItem>
              <MenuItem value="berilgan">{t('creditDirectionBerish')}</MenuItem>
            </TextField>
            <TextField select label={t('location')} fullWidth margin="dense" value={form.location} onChange={handle('location')}>
              <MenuItem value="">{t('selectProduct')}</MenuItem>
              <MenuItem value="do'kon">{t('store')}</MenuItem>
              <MenuItem value="ombor">{t('warehouse')}</MenuItem>
            </TextField>
            <TextField label={t('note')} fullWidth margin="dense" value={form.note} onChange={handle('note')} />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        {initial && !isPayment && (
          <Button onClick={() => setIsPayment(true)} color="success" sx={{ mr: 'auto' }}>
            {t('make_payment')}
          </Button>
        )}
        <Button onClick={onClose} sx={{ minWidth: 100 }}>{t('cancel')}</Button>
        <Button variant="contained" onClick={submit} sx={{ minWidth: 120 }}>{t('save')}</Button>
      </DialogActions>
    </Dialog>
  )
}
