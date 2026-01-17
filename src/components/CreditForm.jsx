import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, MenuItem, Box, Typography } from '@mui/material'
import useExchangeRate from '../hooks/useExchangeRate'
import { v4 as uuidv4 } from 'uuid'
import { useLocale } from '../context/LocaleContext'
import { formatMoney } from '../utils/format'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'

export default function CreditForm({ open, onClose, onSubmit, initial }) {
  const [form, setForm] = useState({ name: '', date: '', amount: 0, currency: 'UZS', type: 'olingan', note: '' })
  const [isPayment, setIsPayment] = useState(false)
  const { rate: usdToUzs } = useExchangeRate()
  const { t } = useLocale()

  useEffect(() => {
    const newForm = initial ? { ...initial } : { name: '', date: '', amount: 0, currency: 'UZS', type: 'olingan', note: '' };
    if (newForm.date && typeof newForm.date === 'string' && newForm.date.length > 10) {
      newForm.date = newForm.date.slice(0, 10);
    } else if (!newForm.date) {
      newForm.date = '';
    }
    setForm(newForm);
    setIsPayment(false);
  }, [initial]);

  const handle = (k) => (evt) => setForm({ ...form, [k]: evt.target.value })

  const submit = () => {
    const totalAmount = isPayment ? form.amount : (Number(form.qty) || 0) * (Number(form.price) || 0);
    const payload = { id: initial?.id || uuidv4(), ...form, amount: totalAmount };
    
    // Ensure date is in YYYY-MM-DD format
    if (!payload.date) {
      payload.date = new Date().toISOString().slice(0, 10)
    } else if (typeof payload.date === 'string' && !payload.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // If date is not in YYYY-MM-DD format, try to convert it
      try {
        const dateObj = new Date(payload.date)
        if (!isNaN(dateObj.getTime())) {
          payload.date = dateObj.toISOString().slice(0, 10)
        } else {
          payload.date = new Date().toISOString().slice(0, 10)
        }
      } catch {
        payload.date = new Date().toISOString().slice(0, 10)
      }
    }
    
    // Determine credit_type based on whether product details are provided
    // If qty and price are provided, it's a 'product' credit, otherwise it's 'cash'
    const hasProductDetails = payload.qty || payload.price || payload.product_name
    payload.credit_type = hasProductDetails ? 'product' : 'cash'
    
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

  const handleClose = () => {
    setIsPayment(false);
    setForm({ name: '', date: '', amount: 0, currency: 'UZS', type: 'olingan', note: '' });
    onClose();
  }

  const remainingDisplay = initial ? (initial.amount - (initial.bosh_toluv || 0)) : 0

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
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
            <CurrencyField label={t('payment')} fullWidth margin="dense" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} currency={initial?.currency || 'UZS'} />
            <TextField type="date" label={t('date')} fullWidth margin="dense" value={form.date} onChange={handle('date')} InputLabelProps={{ shrink: true }} />
            <TextField label={t('note')} fullWidth margin="dense" value={form.note} onChange={handle('note')} />
          </>
        ) : (
          <>
            <TextField label={t('who')} fullWidth margin="dense" value={form.name} onChange={handle('name')} />
            <TextField label={t('productName')} fullWidth margin="dense" value={form.product_name} onChange={handle('product_name')} disabled={!!initial} />
            <NumberField label={t('qty')} fullWidth margin="dense" value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} disabled={!!initial} />
            <CurrencyField label={t('price')} fullWidth margin="dense" value={form.price} onChange={(v) => setForm({ ...form, price: v })} disabled={!!initial} currency={form.currency} />
            <TextField type="date" label={t('date')} fullWidth margin="dense" value={form.date} onChange={handle('date')} InputLabelProps={{ shrink: true }} />
            <Typography variant="body2" sx={{ mt: 1 }}>{t('total_amount')}: {formatMoney((Number(form.qty) || 1) * (Number(form.price) || 0))} {form.currency}</Typography>
            <Box sx={{ border: '1px solid #ccc', borderRadius: 1, p: 2, mt: 2 }}>
              <CurrencyField label={t('boshToluv')} fullWidth margin="dense" value={form.bosh_toluv} onChange={(v) => setForm({ ...form, bosh_toluv: v })} currency={form.currency} />
              <TextField label={t('down_payment_note')} fullWidth margin="dense" value={form.down_payment_note} onChange={handle('down_payment_note')} />
            </Box>
            <TextField select label={t('currency')} fullWidth margin="dense" value={form.currency} onChange={handle('currency')} disabled={!!initial}>
              <MenuItem value="UZS">UZS</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
            </TextField>
            {form.currency === 'USD' && !isPayment ? (
              <Box sx={{ mt: 1 }}>
                <TextField label="Jami (UZS)" type="text" fullWidth margin="dense" value={form.amount && usdToUzs ? Math.round(Number(form.amount) * usdToUzs) : ''} disabled />
              </Box>
            ) : null}
            <TextField select label={t('type')} fullWidth margin="dense" value={form.type} onChange={handle('type')} disabled={!!initial}>
              <MenuItem value="olingan">{t('creditDirectionOlingan')}</MenuItem>
              <MenuItem value="berilgan">{t('creditDirectionBerish')}</MenuItem>
            </TextField>
            <TextField select label={t('location')} fullWidth margin="dense" value={form.location} onChange={handle('location')} disabled={!!initial}>
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
        <Button onClick={handleClose} sx={{ minWidth: 100 }}>{t('cancel')}</Button>
        <Button variant="contained" onClick={submit} sx={{ minWidth: 120 }}>{t('save')}</Button>
      </DialogActions>
    </Dialog>
  )
}
