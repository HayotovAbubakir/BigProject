import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, FormControl, InputLabel, Select, MenuItem, InputAdornment, TextField } from '@mui/material'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
import useExchangeRate from '../hooks/useExchangeRate'
import { formatMoney } from '../utils/format'

export default function WarehouseSellForm({ open, onClose, onSubmit, initial }) {
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(initial?.price ? Number(initial.price) : 0)
  const [currency, setCurrency] = useState(initial?.currency || 'UZS')
  

  useEffect(() => {
    if (initial) setPrice(initial.price ? Number(initial.price) : 0)
    setQty(1)
  }, [initial, open])

  const available = Number(initial?.qty || 0)
  const parsedQty = Number(qty || 0)
  const parsedPrice = Number(price || 0)
  const invalid = parsedQty <= 0 || parsedQty > available || parsedPrice <= 0
  const { rate: usdToUzs } = useExchangeRate()

  const submit = () => {
    if (invalid) return
    const total = parsedQty * parsedPrice
  const usedRate = usdToUzs || null
    const payload = { id: initial.id, qty: parsedQty, price: parsedPrice, currency }
    if (currency === 'USD' && usedRate) {
      payload.price_uzs = Math.round(parsedPrice * usedRate)
      payload.total_uzs = Math.round(total * usedRate)
    } else {
      payload.total_uzs = Math.round(total)
    }
    onSubmit(payload)
    onClose()
  }

  

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>Sotish</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowWrap: 'break-word' }}>
        <TextField label="Mahsulot" fullWidth margin="dense" size="small" value={initial?.name || ''} disabled />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>Mavjud: {available}</Typography>
        <NumberField
          label="Soni"
          fullWidth
          margin="dense"
          value={qty}
          onChange={(v) => setQty(Number(v || 0))}
          error={invalid}
          helperText={invalid ? (parsedQty <= 0 ? 'Min 1 kiriting' : 'Ko\'p kiritdingiz') : ''}
        />
        <FormControl fullWidth sx={{ mt: 1.5 }}>
          <InputLabel id="wsell-currency-label" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>Valyuta</InputLabel>
          <Select labelId="wsell-currency-label" value={currency} label="Valyuta" onChange={(e) => setCurrency(e.target.value)} size="small">
            <MenuItem value="UZS">UZS</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
          </Select>
        </FormControl>

        <CurrencyField label="Narxi (bir dona)" fullWidth margin="dense" value={price} onChange={(v) => setPrice(v)} currency={currency} />

        {currency === 'USD' ? (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', md: '0.875rem' } }}>Jami: {parsedQty * Number(price || 0)} USD</Typography>
            {usdToUzs ? <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>≈ {formatMoney(Math.round(parsedQty * Number(price || 0) * usdToUzs))} UZS</Typography> : <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>Kurs yo\'q</Typography>}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Jami: {formatMoney(parsedQty * Number(price || 0))} UZS</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
        <Button onClick={onClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Bekor</Button>
        <Button variant="contained" onClick={submit} disabled={invalid} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Sotish</Button>
      </DialogActions>
    </Dialog>
  )
}
