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
  const invalid = parsedQty <= 0 || parsedQty > available
  const { rate: usdToUzs } = useExchangeRate()

  const submit = () => {
    if (invalid) return
    const total = parsedQty * Number(price)
  const usedRate = usdToUzs || null
    const payload = { id: initial.id, qty: parsedQty, price: Number(price), currency }
    if (currency === 'USD' && usedRate) {
      payload.price_uzs = Math.round(Number(price) * usedRate)
      payload.total_uzs = Math.round(total * usedRate)
    } else {
      payload.total_uzs = Math.round(total)
    }
    onSubmit(payload)
    onClose()
  }

  

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: { xs: '1.05rem', md: '1.15rem' } }}>Ombordan mahsulot sotish</DialogTitle>
      <DialogContent>
        <TextField label="Mahsulot" fullWidth margin="dense" value={initial?.name || ''} disabled />
        <Typography variant="caption" color="text.secondary">Mavjud: {available} dona</Typography>
        <NumberField
          label="Soni"
          fullWidth
          margin="dense"
          value={qty}
          onChange={(v) => setQty(Number(v || 0))}
          error={invalid}
          helperText={invalid ? (parsedQty <= 0 ? 'Iltimos 1 yoki undan ko\'p kiriting' : 'Mavjud sondan ortiq kiritdingiz') : ''}
        />
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="wsell-currency-label">Valyuta</InputLabel>
          <Select labelId="wsell-currency-label" value={currency} label="Valyuta" onChange={(e) => setCurrency(e.target.value)}>
            <MenuItem value="UZS">UZS</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
          </Select>
        </FormControl>

        <CurrencyField label="Sotish narxi (bir dona)" fullWidth margin="dense" value={price} onChange={(v) => setPrice(v)} currency={currency} />

        {currency === 'USD' ? (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2">Jami: {parsedQty * Number(price || 0)} USD</Typography>
            {usdToUzs ? <Typography variant="caption" color="text.secondary">Taxminiy: {formatMoney(Math.round(parsedQty * Number(price || 0) * usdToUzs))} UZS</Typography> : <Typography variant="caption" color="text.secondary">No exchange rate set</Typography>}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">Taxminiy qiymat: {formatMoney(parsedQty * Number(price || 0))} UZS</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ minWidth: 100 }}>Bekor</Button>
        <Button variant="contained" onClick={submit} disabled={invalid} sx={{ minWidth: 120 }}>Sotish</Button>
      </DialogActions>
    </Dialog>
  )
}
