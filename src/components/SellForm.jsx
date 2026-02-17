import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, FormControl, InputLabel, Select, MenuItem, Stack } from '@mui/material'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
import useExchangeRate from '../hooks/useExchangeRate'
import { normalizeCategory, isMeterCategory } from '../utils/productCategories'
import { formatMoney } from '../utils/format'

export default function SellForm({ open, onClose, onSubmit, initial }) {
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(initial?.price || '')
  const [currency, setCurrency] = useState(initial?.currency || 'UZS')
  const [unit, setUnit] = useState('dona')
  const [meterQty, setMeterQty] = useState('')
  
  const isElectrode = normalizeCategory(initial?.category) === 'elektrod'
  const isMeter = isMeterCategory(initial)
  const packQty = Number(initial?.pack_qty || 0)
  const meterPriceDefault = Number(initial?.price ?? 0)
  const piecePriceDefault = Number(initial?.price_piece ?? initial?.price ?? 0)
  const packPriceDefault = Number(initial?.price_pack ?? 0)
  const meterAvailable = isMeter ? Number(initial?.meter_qty ?? (Number(initial?.qty || 0) * packQty)) : 0
  const fullPacksAvailable = isMeter && packQty > 0 ? Math.floor(meterAvailable / packQty) : 0
  const openMetersAvailable = isMeter ? meterAvailable - (fullPacksAvailable * packQty) : 0

  useEffect(() => {
    if (initial) {
      setQty(1)
      setUnit(isMeter ? 'metr' : 'dona')
      setCurrency(initial?.currency || 'UZS')
      if (isMeter) {
        setPrice(meterPriceDefault > 0 ? meterPriceDefault : '')
      } else {
        setPrice(piecePriceDefault > 0 ? piecePriceDefault : '')
      }
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
    ? (unit === 'metr' ? meterAvailable : fullPacksAvailable)
    : (isElectrode && unit === 'pachka' ? availablePacks : availablePieces)
  const inputQty = isMeter && unit === 'metr' ? Number(meterQty || 0) : Number(qty || 0)
  const fallbackPrice = isElectrode
    ? (unit === 'pachka' ? packPriceDefault : piecePriceDefault)
    : (isMeter ? (unit === 'metr' ? meterPriceDefault : piecePriceDefault) : piecePriceDefault)
  const parsedPrice = Number(price === '' ? (fallbackPrice || 0) : price)
  const invalid = inputQty <= 0 || inputQty > available || parsedPrice <= 0 || ((unit === 'pachka' || (isMeter && unit === 'dona')) && packQty <= 0)
  const { rate: usdToUzs } = useExchangeRate()
  const total = inputQty * parsedPrice

  const submit = () => {
    if (invalid) return
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '90vh', overflow: 'hidden' } }}>
      <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>Sotish</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowY: 'auto', overflowX: 'hidden' }}>
        <Stack spacing={2}>
          {isMeter ? (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                Mavjud: {meterAvailable} m
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                Butun: {fullPacksAvailable} dona{openMetersAvailable > 0 ? ` | Ochiq: ${openMetersAvailable} m` : ''}
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
            <FormControl fullWidth>
              <InputLabel id="sell-unit-label" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>Birlik</InputLabel>
              <Select
                labelId="sell-unit-label"
                value={unit}
                label="Birlik"
                onChange={(e) => setUnit(e.target.value)}
                size="small"
                MenuProps={{
                  disableScrollLock: true
                }}
              >
                {isMeter
                  ? [
                      <MenuItem key="metr" value="metr">Metr</MenuItem>,
                      <MenuItem key="dona" value="dona">Dona</MenuItem>,
                    ]
                  : [
                      <MenuItem key="dona" value="dona">Dona</MenuItem>,
                      <MenuItem key="pachka" value="pachka" disabled={packQty <= 0}>Pachka</MenuItem>,
                    ]}
              </Select>
            </FormControl>
          )}

          <NumberField
            label={isMeter ? (unit === 'metr' ? 'Metr' : 'Soni (dona)') : (isElectrode ? `Soni (${unit === 'pachka' ? 'pachka' : 'dona'})` : 'Soni')}
            value={isMeter && unit === 'metr' ? meterQty : qty}
            onChange={(v) => {
              if (isMeter && unit === 'metr') {
                setMeterQty(v === null ? '' : v)
              } else {
                setQty(Number(v || 0))
              }
            }}
            fullWidth
            size="small"
            error={inputQty <= 0 || inputQty > available}
            helperText={(inputQty <= 0 ? 'Min 1' : (inputQty > available ? 'Ko\'p' : ''))}
          />

          <FormControl fullWidth>
            <InputLabel id="sell-currency-label" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>Valyuta</InputLabel>
            <Select labelId="sell-currency-label" value={currency} label="Valyuta" onChange={(e) => setCurrency(e.target.value)} size="small">
              <MenuItem value="UZS">UZS</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
            </Select>
          </FormControl>

          {isMeter && (
            <Box sx={{ display: 'flex', gap: 2, rowGap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.72rem', md: '0.8rem' } }}>
                Narx (1 metr): {formatMoney(meterPriceDefault || 0)} {currency}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.72rem', md: '0.8rem' } }}>
                1 dona: {formatMoney(piecePriceDefault || 0)} {currency}
              </Typography>
            </Box>
          )}

          <CurrencyField
            label={isMeter ? (unit === 'metr' ? 'Narxi (1 metr)' : 'Narxi (1 dona)') : (isElectrode ? `Narxi (${unit === 'pachka' ? 'pachka' : 'dona'})` : 'Narxi')}
            value={price}
            onChange={(v) => setPrice(v)}
            fullWidth
            error={parsedPrice <= 0}
            helperText={parsedPrice <= 0 ? 'Musbat' : ''}
            currency={currency}
          />

          {currency === 'USD' ? (
            <Box>
              <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', md: '0.875rem' } }}>Jami: {total} USD</Typography>
              {usdToUzs ? (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>≈ {Math.round(total * usdToUzs)} UZS</Typography>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>Kurs yo'q</Typography>
              )}
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Jami: {Math.round(total)} UZS</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
        <Button onClick={onClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Bekor</Button>
        <Button variant="contained" onClick={submit} disabled={invalid} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Sotish</Button>
      </DialogActions>
    </Dialog>
  )
}
