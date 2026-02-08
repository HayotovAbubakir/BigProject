import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, FormHelperText } from '@mui/material'
import NumberField from './NumberField'
import { normalizeCategory } from '../utils/productCategories'

export default function MoveToStoreForm({ open, onClose, onSubmit, initial }) {
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const isElectrode = normalizeCategory(initial?.category) === 'elektrod'

  useEffect(() => {
    if (initial) {
      setQty(1)
      
      const basePiece = Number(initial.price_piece ?? initial.price ?? 0)
      const pref = basePiece * 1.2
      setPrice(pref ? String(pref) : '')
      setError('')
    }
  }, [initial, open])

  const submit = () => {
    const nQty = Number(qty)
    const nPrice = Number(price)
    if (!initial) return
    if (nQty <= 0) return setError('Soni 0 dan katta bo\'lishi kerak')
    if (nQty > (initial.qty || 0)) return setError('Omborda yetarli miqdor yo\'q')
    if (nPrice <= 0) return setError('Narx 0 dan katta bo\'lishi kerak')

    const nextItem = { 
      ...initial, 
      qty: nQty, 
      date: new Date().toISOString().slice(0,10), 
      price: nPrice,
      price_piece: nPrice
    }
    onSubmit({ id: initial.id, qty: nQty, item: nextItem })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>O'tkazish</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowWrap: 'break-word' }}>
        <Box sx={{ mt: 1, display: 'grid', gap: 1.5 }}>
          <NumberField label="Soni" value={qty} onChange={(v) => setQty(Number(v || 0))} fullWidth />
          <NumberField label={isElectrode ? "Do'kon narxi (dona)" : "Do'kon narxi"} value={price} onChange={(v) => setPrice(String(v || ''))} fullWidth />
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
