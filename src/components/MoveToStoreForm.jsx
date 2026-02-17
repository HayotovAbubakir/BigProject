import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, FormHelperText, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material'
import NumberField from './NumberField'
import { normalizeCategory, isMeterCategory } from '../utils/productCategories'

export default function MoveToStoreForm({ open, onClose, onSubmit, initial }) {
  const [qty, setQty] = useState(1)
  const [meter, setMeter] = useState('')
  const [unit, setUnit] = useState('metr')
  const [price, setPrice] = useState('')
  const [pricePiece, setPricePiece] = useState('')
  const [error, setError] = useState('')
  const isElectrode = normalizeCategory(initial?.category) === 'elektrod'
  const isMeter = isMeterCategory(initial)
  const packQty = Number(initial?.pack_qty || 0)
  const availableMeter = isMeter ? Number(initial?.meter_qty ?? (Number(initial?.qty || 0) * packQty)) : 0
  const availableDona = isMeter && packQty > 0 ? Math.floor(availableMeter / packQty) : 0

  useEffect(() => {
    if (initial) {
      setQty(1)
      setMeter('')
      setUnit(isMeter ? 'metr' : 'dona')
      const baseMeter = Number(initial.price ?? 0)
      const basePiece = Number(initial.price_piece ?? initial.price ?? 0)
      const prefMeter = baseMeter ? baseMeter * 1.2 : 0
      const prefPiece = basePiece ? basePiece * 1.2 : 0
      setPrice(prefMeter ? String(prefMeter) : '')
      setPricePiece(prefPiece ? String(prefPiece) : '')
      setError('')
    }
  }, [initial, open])

  const submit = () => {
    const nQty = Number(qty)
    const nMeter = Number(meter)
    const nPrice = Number(price)
    const nPiecePrice = Number(pricePiece)
    if (!initial) return
    if (isMeter) {
      if (unit === 'metr') {
        if (nMeter <= 0) return setError('Metr 0 dan katta bo\'lishi kerak')
        if (nMeter > availableMeter) return setError('Omborda yetarli metr yo\'q')
      } else {
        if (nQty <= 0) return setError('Soni 0 dan katta bo\'lishi kerak')
        if (nQty > availableDona) return setError('Omborda yetarli dona yo\'q')
      }
      if (nPrice <= 0) return setError('Narx (1 metr) 0 dan katta bo\'lishi kerak')
      if (nPiecePrice <= 0) return setError('Narx (1 dona) 0 dan katta bo\'lishi kerak')
    } else {
      if (nQty <= 0) return setError('Soni 0 dan katta bo\'lishi kerak')
      if (nQty > (initial.qty || 0)) return setError('Omborda yetarli miqdor yo\'q')
      if (nPrice <= 0) return setError('Narx 0 dan katta bo\'lishi kerak')
    }

    const nextItem = { 
      ...initial, 
      qty: nQty, 
      date: new Date().toISOString().slice(0,10), 
      price: nPrice,
      price_piece: nPiecePrice || nPrice
    }
    if (isMeter) {
      const meterDelta = unit === 'dona' ? nQty * packQty : nMeter
      const moveQty = unit === 'dona' ? nQty : (packQty > 0 ? Math.ceil(meterDelta / packQty) : nQty)
      const itemForStore = { ...nextItem, qty: moveQty, meter_qty: meterDelta, pack_qty: packQty }
      onSubmit({ id: initial.id, qty: moveQty, meter_qty: meterDelta, unit, pack_qty: packQty, item: itemForStore })
    } else {
      onSubmit({ id: initial.id, qty: nQty, item: nextItem })
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>O'tkazish</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowWrap: 'break-word', overflowX: 'visible' }}>
        <Box sx={{ mt: 1, display: 'grid', gap: 1.5 }}>
          {isMeter && (
            <>
              <Typography variant="caption" color="text.secondary">
                Mavjud: {availableMeter} m ({availableDona} dona)
              </Typography>
              {packQty > 0 && (
                <Typography variant="caption" color="text.secondary">
                  1 dona: {packQty} m
                </Typography>
              )}
              <FormControl fullWidth size="small">
                <InputLabel id="move-unit-label">Birlik</InputLabel>
                <Select
                  labelId="move-unit-label"
                  value={unit}
                  label="Birlik"
                  onChange={(e) => setUnit(e.target.value)}
                  size="small"
                  MenuProps={{
                    disablePortal: true,
                    getContentAnchorEl: null,
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' },
                    PaperProps: { sx: { maxWidth: '100%', boxSizing: 'border-box' } },
                    disableScrollLock: true
                  }}
                >
                  <MenuItem value="metr">Metr</MenuItem>
                  <MenuItem value="dona">Dona</MenuItem>
                </Select>
              </FormControl>
            </>
          )}

          {isMeter ? (
            unit === 'metr' ? (
              <NumberField label="Metr" value={meter} onChange={(v) => setMeter(v === null ? '' : v)} fullWidth />
            ) : (
              <NumberField label="Soni (dona)" value={qty} onChange={(v) => setQty(Number(v || 0))} fullWidth />
            )
          ) : (
            <NumberField label="Soni" value={qty} onChange={(v) => setQty(Number(v || 0))} fullWidth />
          )}

          {isMeter ? (
            <>
              <NumberField label="Do'kon narxi (1 metr)" value={price} onChange={(v) => setPrice(String(v || ''))} fullWidth />
              <NumberField label="Do'kon narxi (1 dona)" value={pricePiece} onChange={(v) => setPricePiece(String(v || ''))} fullWidth />
            </>
          ) : (
            <NumberField label={isElectrode ? "Do'kon narxi (dona)" : "Do'kon narxi"} value={price} onChange={(v) => setPrice(String(v || ''))} fullWidth />
          )}

          {error && <FormHelperText error sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>{error}</FormHelperText>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
        <Button onClick={onClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Bekor</Button>
        <Button variant="contained" onClick={submit} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>O'tkazish</Button>
      </DialogActions>
    </Dialog>
  )
}
