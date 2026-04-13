import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, FormHelperText, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material'
import NumberField from './NumberField'
import { normalizeCategory, isMeterCategory } from '../utils/productCategories'
import { useLocale } from '../context/LocaleContext'

export default function MoveToStoreForm({ open, onClose, onSubmit, initial }) {
  const { t } = useLocale()
  const [qty, setQty] = useState('')
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
      setQty('')
      setMeter('')
      setUnit(isMeter ? 'metr' : 'dona')
      const baseMeter = Number(initial.price ?? 0)
      const basePiece = Number(initial.price_piece ?? initial.price ?? 0)
      // Use original product prices as defaults when moving to store (no automatic markup)
      const prefMeter = baseMeter ? baseMeter : 0
      const prefPiece = basePiece ? basePiece : 0
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
        if (nMeter <= 0) return setError(t('validation_meter_positive'))
        if (nMeter > availableMeter) return setError(t('validation_meter_insufficient'))
      } else {
        if (nQty <= 0) return setError(t('validation_qty_positive'))
        if (nQty > availableDona) return setError(t('validation_qty_insufficient'))
      }
      if (nPrice <= 0) return setError(t('validation_price_meter_positive'))
      if (nPiecePrice <= 0) return setError(t('validation_price_piece_positive'))
    } else {
      if (nQty <= 0) return setError(t('validation_qty_positive'))
      if (nQty > (initial.qty || 0)) return setError(t('validation_qty_insufficient'))
      if (nPrice <= 0) return setError(t('validation_price_positive'))
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
      <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>{t('move_to_store_title') || t('move_to_store')}</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowWrap: 'break-word', overflowX: 'visible' }}>
        <Box sx={{ mt: 1, display: 'grid', gap: 1.5 }}>
          {isMeter && (
            <>
              <Typography variant="caption" color="text.secondary">
                {t('available_caption', { value: `${availableMeter} m (${availableDona} ${t('unit_piece') || 'dona'})` }) || `${t('available')}: ${availableMeter} m (${availableDona} ${t('unit_piece')})`}
              </Typography>
              {packQty > 0 && (
                <Typography variant="caption" color="text.secondary">
                  1 {t('unit_piece') || 'dona'}: {packQty} m
                </Typography>
              )}
              <FormControl fullWidth size="small">
                <InputLabel id="move-unit-label">{t('unit') || 'Birlik'}</InputLabel>
                <Select
                  labelId="move-unit-label"
                  value={unit}
                  label={t('unit') || 'Birlik'}
                  onChange={(e) => setUnit(e.target.value)}
                  size="small"
                  MenuProps={{
                    // Render dropdown in portal to avoid dialog overflow/layout issues
                    disablePortal: false,
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' },
                    PaperProps: { sx: { maxWidth: '100%', boxSizing: 'border-box' } },
                    disableScrollLock: true
                  }}
                >
                  <MenuItem value="metr">{t('unit_meter') || 'Metr'}</MenuItem>
                  <MenuItem value="dona">{t('unit_piece') || 'Dona'}</MenuItem>
                </Select>
              </FormControl>
            </>
          )}

          {isMeter ? (
            unit === 'metr' ? (
              <NumberField label={t('unit_meter') || 'Metr'} value={meter} onChange={(v) => setMeter(v === null ? '' : v)} fullWidth />
            ) : (
              <NumberField label={t('quantity_piece') || t('qty')} value={qty} onChange={(v) => setQty(v === null ? '' : v)} fullWidth />
            )
          ) : (
            <NumberField label={t('qty')} value={qty} onChange={(v) => setQty(v === null ? '' : v)} fullWidth />
          )}

          {isMeter ? (
            <>
              <NumberField label={t('store_price_per_meter')} value={price} onChange={(v) => setPrice(String(v || ''))} fullWidth />
              <NumberField label={t('store_price_per_piece')} value={pricePiece} onChange={(v) => setPricePiece(String(v || ''))} fullWidth />
            </>
          ) : (
            <NumberField label={isElectrode ? `${t('store_price_per_piece')}` : t('price')} value={price} onChange={(v) => setPrice(String(v || ''))} fullWidth />
          )}

          {error && <FormHelperText error sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>{error}</FormHelperText>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
        <Button onClick={onClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>{t('cancel')}</Button>
        <Button variant="contained" onClick={submit} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>{t('move_to_store_title') || t('move_to_store')}</Button>
      </DialogActions>
    </Dialog>
  )
}
