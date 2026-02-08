import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, FormHelperText } from '@mui/material'
import NumberField from './NumberField'

export default function AddQuantityForm({ open, onClose, onSubmit, initial, source = 'warehouse' }) {
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initial) {
      setQty(1)
      setError('')
    }
  }, [initial, open])

  const submit = () => {
    const nQty = Number(qty)
    if (!initial) return
    if (nQty <= 0) return setError('Qiymat 0 dan katta bo\'lishi kerak')

    onSubmit({ id: initial.id, qty: nQty, item: initial })
    onClose()
  }

  const sourceTitle = source === 'warehouse' ? 'Omborga qo\'sh.' : 'Do\'konga qo\'sh.'

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>{sourceTitle}</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowWrap: 'break-word' }}>
        <Box sx={{ mt: 1, display: 'grid', gap: 1.5 }}>
          <Box>
            <Box sx={{ fontSize: { xs: '0.8rem', md: '0.9rem' }, color: 'text.secondary', mb: 1 }}>
              Mavjud: <strong>{initial?.qty || 0}</strong>
            </Box>
            <NumberField label="Qo'shish soni" value={qty} onChange={(v) => setQty(Number(v || 0))} fullWidth />
            <Box sx={{ fontSize: { xs: '0.75rem', md: '0.85rem' }, color: 'info.main', mt: 1 }}>
              Jami: <strong>{Number(initial?.qty || 0) + Number(qty || 0)}</strong>
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
