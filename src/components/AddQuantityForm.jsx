import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, FormHelperText, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material'
import NumberField from './NumberField'
import { isMeterCategory } from '../utils/productCategories'
import { useLocale } from '../context/LocaleContext'

export default function AddQuantityForm({ open, onClose, onSubmit, initial, source = 'warehouse' }) {
  const { t } = useLocale()
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')
  const [unit, setUnit] = useState('metr')

  useEffect(() => {
    if (initial) {
      setQty('')
      setUnit('metr')
      setError('')
    }
  }, [initial, open])

  const submit = () => {
    const nQty = Number(qty || 0)
    if (!initial) return
    if (nQty <= 0) return setError(t('validation_qty_positive'))

    const isMeter = isMeterCategory(initial)
    if (isMeter) {
      const packQty = Number(initial?.pack_qty || 0)
      if (unit === 'dona' && packQty <= 0) return setError(t('validation_unit_pack_missing'))
      const baseMeter = Number(initial?.meter_qty ?? (Number(initial?.qty || 0) * packQty))
      const meterDelta = unit === 'dona' ? nQty * packQty : nQty
      const nextMeter = baseMeter + meterDelta
      const nextQty = packQty > 0 ? Math.ceil(nextMeter / packQty) : Number(initial?.qty || 0)
      onSubmit({ id: initial.id, qty: nQty, meter_delta: meterDelta, meter_qty: nextMeter, unit, item: initial, next_qty: nextQty })
      onClose()
      return
    }

    onSubmit({ id: initial.id, qty: nQty, item: initial })
    onClose()
  }

  const sourceTitle = source === 'warehouse' ? (t('add_title') || t('add')) : (t('add_title') || t('add'))
  const isMeter = isMeterCategory(initial)
  const packQty = Number(initial?.pack_qty || 0)
  const baseMeter = Number(initial?.meter_qty ?? (Number(initial?.qty || 0) * packQty))
  const meterDelta = isMeter ? (unit === 'dona' ? Number(qty || 0) * packQty : Number(qty || 0)) : 0
  const nextMeter = isMeter ? baseMeter + meterDelta : baseMeter
  const nextQty = isMeter ? (packQty > 0 ? Math.ceil(nextMeter / packQty) : Number(initial?.qty || 0)) : Number(initial?.qty || 0) + Number(qty || 0)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>{sourceTitle}</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowWrap: 'break-word', overflowX: 'hidden' }}>
        <Box sx={{ mt: 1, display: 'grid', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
            {isMeter
              ? <>{t('available')}: <strong>{baseMeter} m</strong> ({t('unit_piece') || 'Dona'}: <strong>{packQty > 0 ? Math.ceil(baseMeter / packQty) : 0}</strong>)</>
              : <>{t('available')}: <strong>{initial?.qty || 0}</strong></>}
          </Typography>

          {isMeter && (
            <FormControl fullWidth size="small" sx={{ mb: 0.5 }}>
              <InputLabel id="add-unit-label">{t('unit') || 'Birlik'}</InputLabel>
              <Select
                labelId="add-unit-label"
                value={unit}
                label={t('unit') || 'Birlik'}
                onChange={(e) => setUnit(e.target.value)}
                size="small"
                MenuProps={{
                  // Render menu in a portal (outside the dialog) to avoid creating
                  // inner scrollbars and layout break when switching units.
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
          )}

          <NumberField
            label={isMeter ? (unit === 'metr' ? (t('unit_meter') || 'Metr') : (t('quantity_piece') || t('qty'))) : t('add')}
            value={qty}
            onChange={(v) => setQty(v ?? '')}
            fullWidth
            size="small"
            inputProps={{ style: { minWidth: 0 } }}
          />

          <Typography variant="body2" color="info.main" sx={{ wordBreak: 'break-word' }}>
            {isMeter
              ? <>{t('total')}: <strong>{nextMeter} m</strong> ({t('unit_piece') || 'Dona'}: <strong>{nextQty}</strong>)</>
              : <>{t('total')}: <strong>{Number(initial?.qty || 0) + Number(qty || 0)}</strong></>}
          </Typography>

          {error && <FormHelperText error sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>{error}</FormHelperText>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
        <Button onClick={onClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>{t('cancel')}</Button>
        <Button variant="contained" onClick={submit} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>{t('add')}</Button>
      </DialogActions>
    </Dialog>
  )
}
