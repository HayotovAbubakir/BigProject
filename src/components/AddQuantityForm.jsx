import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, FormHelperText, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material'
import NumberField from './NumberField'
import { isMeterCategory } from '../utils/productCategories'

export default function AddQuantityForm({ open, onClose, onSubmit, initial, source = 'warehouse' }) {
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')
  const [unit, setUnit] = useState('metr')

  useEffect(() => {
    if (initial) {
      setQty(1)
      setUnit('metr')
      setError('')
    }
  }, [initial, open])

  const submit = () => {
    const nQty = Number(qty)
    if (!initial) return
    if (nQty <= 0) return setError('Qiymat 0 dan katta bo\'lishi kerak')

    const isMeter = isMeterCategory(initial)
    if (isMeter) {
      const packQty = Number(initial?.pack_qty || 0)
      if (unit === 'dona' && packQty <= 0) return setError('Metr qiymati topilmadi')
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

  const sourceTitle = source === 'warehouse' ? 'Omborga qo\'sh.' : 'Do\'konga qo\'sh.'
  const isMeter = isMeterCategory(initial)
  const packQty = Number(initial?.pack_qty || 0)
  const baseMeter = Number(initial?.meter_qty ?? (Number(initial?.qty || 0) * packQty))
  const meterDelta = isMeter ? (unit === 'dona' ? Number(qty || 0) * packQty : Number(qty || 0)) : 0
  const nextMeter = isMeter ? baseMeter + meterDelta : baseMeter
  const nextQty = isMeter ? (packQty > 0 ? Math.ceil(nextMeter / packQty) : Number(initial?.qty || 0)) : Number(initial?.qty || 0) + Number(qty || 0)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>{sourceTitle}</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowWrap: 'break-word' }}>
        <Box sx={{ mt: 1, display: 'grid', gap: 1.5 }}>
          <Box>
            <Box sx={{ fontSize: { xs: '0.8rem', md: '0.9rem' }, color: 'text.secondary', mb: 1 }}>
              {isMeter ? (
                <Typography variant="body2" component="span">
                  Mavjud: <strong>{baseMeter} m</strong> (Dona: <strong>{packQty > 0 ? Math.ceil(baseMeter / packQty) : 0}</strong>)
                </Typography>
              ) : (
                <>Mavjud: <strong>{initial?.qty || 0}</strong></>
              )}
            </Box>
            {isMeter && (
              <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                <InputLabel id="add-unit-label">Birlik</InputLabel>
                <Select
                  labelId="add-unit-label"
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
            )}
            <NumberField label={isMeter ? (unit === 'metr' ? "Metr" : "Soni (dona)") : "Qo'shish soni"} value={qty} onChange={(v) => setQty(Number(v || 0))} fullWidth />
            <Box sx={{ fontSize: { xs: '0.75rem', md: '0.85rem' }, color: 'info.main', mt: 1 }}>
              {isMeter ? (
                <>Jami: <strong>{nextMeter} m</strong> (Dona: <strong>{nextQty}</strong>)</>
              ) : (
                <>Jami: <strong>{Number(initial?.qty || 0) + Number(qty || 0)}</strong></>
              )}
            </Box>
          </Box>
          {error && <FormHelperText error sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>{error}</FormHelperText>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
        <Button onClick={onClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Bekor</Button>
        <Button variant="contained" onClick={submit} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Qo'sh.</Button>
      </DialogActions>
    </Dialog>
  )
}
