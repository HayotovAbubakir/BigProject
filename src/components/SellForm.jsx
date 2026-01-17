import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, FormControl, InputLabel, Select, MenuItem, InputAdornment } from '@mui/material'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
import useExchangeRate from '../hooks/useExchangeRate'

export default function SellForm({ open, onClose, onSubmit, initial }) {
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(initial?.price || '')
  const [currency, setCurrency] = useState(initial?.currency || 'UZS')
  

  useEffect(() => { if (initial) { setQty(1); setPrice(initial?.price || '') } }, [initial, open])

  const available = Number(initial?.qty || 0)
  const parsedQty = Number(qty || 0)
  const parsedPrice = Number(price === '' ? (initial?.price || 0) : price)
  const invalid = parsedQty <= 0 || parsedQty > available || parsedPrice <= 0
  const { rate: usdToUzs } = useExchangeRate()
  const total = parsedQty * parsedPrice


  const submit = () => {
    if (invalid) return
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
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Mahsulot sotish</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary">Mavjud: {available} dona</Typography>
        <NumberField label="Soni" value={qty} onChange={(v) => setQty(Number(v || 0))} fullWidth sx={{ mt: 2 }} error={parsedQty <= 0 || parsedQty > available} helperText={(parsedQty <= 0 ? '1 yoki undan ko\'p kiriting' : (parsedQty > available ? 'Mavjud sondan ortiq' : ''))} />

        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="sell-currency-label">Valyuta</InputLabel>
          <Select labelId="sell-currency-label" value={currency} label="Valyuta" onChange={(e) => setCurrency(e.target.value)}>
            <MenuItem value="UZS">UZS</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
          </Select>
        </FormControl>

        <CurrencyField label="Birlik narxi" value={price} onChange={(v) => setPrice(v)} fullWidth sx={{ mt: 2 }} error={parsedPrice <= 0} helperText={parsedPrice <= 0 ? 'Musbat narx kiriting' : ''} currency={currency} />

        {currency === 'USD' ? (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mt: 1 }}>Jami: {total} USD</Typography>
            {usdToUzs ? (
              <Typography variant="caption" color="text.secondary">Taxminiy: {Math.round(total * usdToUzs)} UZS</Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">No exchange rate set</Typography>
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>Taxminiy qiymat: {Math.round(total)} UZS</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bekor</Button>
        <Button variant="contained" onClick={submit} disabled={invalid}>Sotish</Button>
      </DialogActions>
    </Dialog>
  )
}
