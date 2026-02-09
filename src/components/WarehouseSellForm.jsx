import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
import useExchangeRate from '../hooks/useExchangeRate'
import { formatMoney } from '../utils/format'
import { normalizeCategory, isMeterCategory } from '../utils/productCategories'
import { formatProductName } from '../utils/productDisplay'

export default function WarehouseSellForm({ open, onClose, onSubmit, initial }) {
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(initial?.price ? Number(initial.price) : 0)
  const [currency, setCurrency] = useState(initial?.currency || 'UZS')
  const [unit, setUnit] = useState('dona')
  const [meterQty, setMeterQty] = useState('')
  

  const isElectrode = normalizeCategory(initial?.category) === 'elektrod'
  const isMeter = isMeterCategory(initial?.category)
  const packQty = Number(initial?.pack_qty || 0)
  const meterPriceDefault = Number(initial?.price ?? 0)
  const piecePriceDefault = Number(initial?.price_piece ?? initial?.price ?? 0)
  const packPriceDefault = Number(initial?.price_pack ?? 0)
  const meterAvailable = isMeter ? Number(initial?.meter_qty ?? (Number(initial?.qty || 0) * packQty)) : 0
  const meterAvailableDona = isMeter && packQty > 0 ? Math.floor(meterAvailable / packQty) : 0
  const nameWithSize = initial ? formatProductName(initial) : ''

  useEffect(() => {
    if (initial) {
      setPrice(isMeter ? (meterPriceDefault > 0 ? meterPriceDefault : 0) : (piecePriceDefault > 0 ? piecePriceDefault : 0))
      setQty(1)
      setUnit(isMeter ? 'metr' : 'dona')
      setCurrency(initial?.currency || 'UZS')
      setMeterQty('')
    }
  }, [initial, open, piecePriceDefault, meterPriceDefault, isMeter])

  useEffect(() => {
    if (isElectrode) {
      if (unit === 'pachka') {
        if (packPriceDefault > 0) setPrice(packPriceDefault)
      } else {
        if (piecePriceDefault > 0) setPrice(piecePriceDefault)
      }
      return
    }
    if (isMeter) {
      if (unit === 'metr') {
        if (meterPriceDefault > 0) setPrice(meterPriceDefault)
      } else if (piecePriceDefault > 0) {
        setPrice(piecePriceDefault)
      }
    }
  }, [unit, isElectrode, isMeter, packPriceDefault, piecePriceDefault, meterPriceDefault])

  const availablePieces = Number(initial?.qty || 0)
  const availablePacks = packQty > 0 ? Math.floor(availablePieces / packQty) : 0
  const available = isMeter
    ? (unit === 'metr' ? meterAvailable : meterAvailableDona)
    : (isElectrode && unit === 'pachka' ? availablePacks : availablePieces)
  const inputQty = isMeter && unit === 'metr' ? Number(meterQty || 0) : Number(qty || 0)
  const parsedPrice = Number(price || 0)
  const qtyError = inputQty <= 0 || inputQty > available || ((unit === 'pachka' || (isMeter && unit === 'dona')) && packQty <= 0)
  const invalid = qtyError || parsedPrice <= 0
  const { rate: usdToUzs } = useExchangeRate()
  const totalValue = inputQty * parsedPrice

  const submit = () => {
    if (invalid) return
    const total = totalValue
    const usedRate = usdToUzs || null
    const meterSold = isMeter ? (unit === 'dona' ? inputQty * packQty : inputQty) : 0
    const deductQty = isMeter
      ? (unit === 'dona' ? inputQty : (packQty > 0 ? Math.ceil(meterSold / packQty) : 0))
      : (unit === 'pachka' ? inputQty * packQty : inputQty)
    const payload = { id: initial.id, qty: inputQty, deduct_qty: deductQty, price: parsedPrice, currency, unit, pack_qty: packQty, meter_qty: meterSold }
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
        <TextField label="Mahsulot" fullWidth margin="dense" size="small" value={nameWithSize} disabled />
        {isMeter ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
              Mavjud: {meterAvailable} m ({meterAvailableDona} dona)
            </Typography>
            {packQty > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                1 dona: {packQty} m
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
            Mavjud: {availablePieces} dona{isElectrode ? ` (${availablePacks} pachka)` : ''}
          </Typography>
        )}
        {isElectrode && packQty > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
            Pachkada: {packQty} dona
          </Typography>
        )}
        {(isElectrode || isMeter) && (
          <FormControl fullWidth sx={{ mt: 1.5 }}>
            <InputLabel id="wsell-unit-label" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>Birlik</InputLabel>
            <Select
              labelId="wsell-unit-label"
              value={unit}
              label="Birlik"
              onChange={(e) => setUnit(e.target.value)}
              size="small"
            >
              {isMeter ? (
                <>
                  <MenuItem value="metr">Metr</MenuItem>
                  <MenuItem value="dona">Dona</MenuItem>
                </>
              ) : (
                <>
                  <MenuItem value="dona">Dona</MenuItem>
                  <MenuItem value="pachka" disabled={packQty <= 0}>Pachka</MenuItem>
                </>
              )}
            </Select>
          </FormControl>
        )}
        <NumberField
          label={isMeter ? (unit === 'metr' ? 'Metr' : 'Soni (dona)') : (isElectrode ? `Soni (${unit === 'pachka' ? 'pachka' : 'dona'})` : 'Soni')}
          fullWidth
          margin="dense"
          value={isMeter && unit === 'metr' ? meterQty : qty}
          onChange={(v) => {
            if (isMeter && unit === 'metr') {
              setMeterQty(v === null ? '' : v)
            } else {
              setQty(Number(v || 0))
            }
          }}
          error={qtyError}
          helperText={qtyError ? (inputQty <= 0 ? 'Min 1 kiriting' : 'Ko\'p kiritdingiz') : ''}
        />
        <FormControl fullWidth sx={{ mt: 1.5 }}>
          <InputLabel id="wsell-currency-label" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>Valyuta</InputLabel>
          <Select labelId="wsell-currency-label" value={currency} label="Valyuta" onChange={(e) => setCurrency(e.target.value)} size="small">
            <MenuItem value="UZS">UZS</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
          </Select>
        </FormControl>

        <CurrencyField
          label={isMeter ? (unit === 'metr' ? 'Narxi (1 metr)' : 'Narxi (1 dona)') : (isElectrode ? `Narxi (${unit === 'pachka' ? 'pachka' : 'dona'})` : 'Narxi (bir dona)')}
          fullWidth
          margin="dense"
          value={price}
          onChange={(v) => setPrice(v)}
          currency={currency}
        />

        {currency === 'USD' ? (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', md: '0.875rem' } }}>Jami: {totalValue} USD</Typography>
            {usdToUzs ? <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>≈ {formatMoney(Math.round(totalValue * usdToUzs))} UZS</Typography> : <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>Kurs yo\'q</Typography>}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Jami: {formatMoney(totalValue)} UZS</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
        <Button onClick={onClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Bekor</Button>
        <Button variant="contained" onClick={submit} disabled={invalid} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Sotish</Button>
      </DialogActions>
    </Dialog>
  )
}
