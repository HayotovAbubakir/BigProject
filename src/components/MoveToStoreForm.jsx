import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, FormHelperText } from '@mui/material'
import NumberField from './NumberField'

export default function MoveToStoreForm({ open, onClose, onSubmit, initial }) {
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (initial) {
      setQty(1)
      
      const pref = (initial.price || 0) * 1.2
      setPrice(pref ? String(pref) : '')
      setError('')
    }
  }, [initial, open])

  const submit = () => {
    const nQty = Number(qty)
    const nPrice = Number(price)
    if (!initial) return
    if (!nQty || nQty <= 0) return setError('Iltimos, oylik sonini toʻgʻri kiriting')
    if (nQty > (initial.qty || 0)) return setError('Omborda yetarli miqdor yoʻq')
    if (!nPrice || nPrice <= 0) return setError('Iltimos, narxni toʻgʻri kiriting')

    onSubmit({ id: initial.id, qty: nQty, item: { ...initial, qty: nQty, date: new Date().toISOString().slice(0,10), price: nPrice } })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: { xs: '1.05rem', md: '1.15rem' } }}>Ombordan Do'konga o'tkazish</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1, display: 'grid', gap: 2 }}>
          <NumberField label="Soni" value={qty} onChange={(v) => setQty(Number(v || 0))} fullWidth />
          <NumberField label="Do'kon narxi (sozlanadigan)" value={price} onChange={(v) => setPrice(String(v || ''))} fullWidth />
          {error && <FormHelperText error>{error}</FormHelperText>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ minWidth: 100 }}>Bekor</Button>
        <Button variant="contained" onClick={submit} sx={{ minWidth: 120 }}>O'tkazish</Button>
      </DialogActions>
    </Dialog>
  )
}
