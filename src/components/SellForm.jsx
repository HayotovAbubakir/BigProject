import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, FormControl, InputLabel, Select, MenuItem, InputAdornment } from '@mui/material'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
import useExchangeRate from '../hooks/useExchangeRate'
import { normalizeCategory } from '../utils/productCategories'

export default function SellForm({ open, onClose, onSubmit, initial }) {
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(initial?.price || '')
  const [currency, setCurrency] = useState(initial?.currency || 'UZS')
  const [unit, setUnit] = useState('dona')
  

  const isElectrode = normalizeCategory(initial?.category) === 'elektrod'
  const packQty = Number(initial?.pack_qty || 0)
  const piecePriceDefault = Number(initial?.price_piece ?? initial?.price ?? 0)
  const packPriceDefault = Number(initial?.price_pack ?? 0)

  useEffect(() => {
    if (initial) {
      setQty(1)
      setUnit('dona')
      setCurrency(initial?.currency || 'UZS')
      setPrice(piecePriceDefault || '')
    }
  }, [initial, open, piecePriceDefault])

  useEffect(() => {
    if (!isElectrode) return
    if (unit === 'pachka') {
      setPrice(packPriceDefault || '')
    } else {
      setPrice(piecePriceDefault || '')
    }
  }, [unit, isElectrode, packPriceDefault, piecePriceDefault])

  const availablePieces = Number(initial?.qty || 0)
  const availablePacks = packQty > 0 ? Math.floor(availablePieces / packQty) : 0
  const available = isElectrode && unit === 'pachka' ? availablePacks : availablePieces
  const parsedQty = Number(qty || 0)
  const parsedPrice = Number(price === '' ? (initial?.price || 0) : price)
  const invalid = parsedQty <= 0 || parsedQty > available || parsedPrice <= 0 || (unit === 'pachka' && packQty <= 0)
  const { rate: usdToUzs } = useExchangeRate()
  const total = parsedQty * parsedPrice


  const submit = () => {
    if (invalid) return
    const usedRate = usdToUzs || null
    const deductQty = unit === 'pachka' ? parsedQty * packQty : parsedQty
    const payload = { id: initial.id, qty: parsedQty, deduct_qty: deductQty, price: parsedPrice, currency, unit, pack_qty: packQty }
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
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
          Mavjud: {availablePieces} dona{isElectrode ? ` (${availablePacks} pachka)` : ''}
        </Typography>

        {isElectrode && (
          <FormControl fullWidth sx={{ mt: 1.5 }}>
            <InputLabel id="sell-unit-label" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>Birlik</InputLabel>
            <Select
              labelId="sell-unit-label"
              value={unit}
              label="Birlik"
              onChange={(e) => setUnit(e.target.value)}
              size="small"
            >
              <MenuItem value="dona">Dona</MenuItem>
              <MenuItem value="pachka" disabled={packQty <= 0}>Pachka</MenuItem>
            </Select>
          </FormControl>
        )}

        <NumberField
          label={isElectrode ? `Soni (${unit === 'pachka' ? 'pachka' : 'dona'})` : 'Soni'}
          value={qty}
          onChange={(v) => setQty(Number(v || 0))}
          fullWidth
          sx={{ mt: 1.5 }}
          size="small"
          error={parsedQty <= 0 || parsedQty > available}
          helperText={(parsedQty <= 0 ? 'Min 1' : (parsedQty > available ? 'Ko\'p' : ''))}
        />

        <FormControl fullWidth sx={{ mt: 1.5 }}>
          <InputLabel id="sell-currency-label" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>Valyuta</InputLabel>
          <Select labelId="sell-currency-label" value={currency} label="Valyuta" onChange={(e) => setCurrency(e.target.value)} size="small">
            <MenuItem value="UZS">UZS</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
          </Select>
        </FormControl>

        <CurrencyField
          label={isElectrode ? `Narxi (${unit === 'pachka' ? 'pachka' : 'dona'})` : 'Narxi'}
          value={price}
          onChange={(v) => setPrice(v)}
          fullWidth
          sx={{ mt: 1.5 }}
          error={parsedPrice <= 0}
          helperText={parsedPrice <= 0 ? 'Musbat' : ''}
          currency={currency}
        />

        {currency === 'USD' ? (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mt: 1, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>Jami: {total} USD</Typography>
            {usdToUzs ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>≈ {Math.round(total * usdToUzs)} UZS</Typography>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>Kurs yo\'q</Typography>
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Jami: {Math.round(total)} UZS</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
        <Button onClick={onClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Bekor</Button>
        <Button variant="contained" onClick={submit} disabled={invalid} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Sotish</Button>
      </DialogActions>
    </Dialog>
  )
}
