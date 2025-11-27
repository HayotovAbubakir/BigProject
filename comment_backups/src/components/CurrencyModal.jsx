import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, RadioGroup, FormControlLabel, Radio, TextField, Box } from '@mui/material'

export default function CurrencyModal({ open, onClose, current = 'UZS', onConfirm }) {
  const [currency, setCurrency] = useState(current)

  useEffect(() => {
    if (!open) return
    setCurrency(current || 'UZS')
  }, [open, current])

  const handleConfirm = () => {
    onConfirm && onConfirm({ currency })
    onClose && onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Valyuta tanlash</DialogTitle>
      <DialogContent>
        <RadioGroup value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <FormControlLabel value="UZS" control={<Radio />} label="UZS" />
          <FormControlLabel value="USD" control={<Radio />} label="USD" />
        </RadioGroup>
        {/* Rate input removed — use global rate from menu */}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bekor qilish</Button>
        <Button variant="contained" onClick={handleConfirm}>OK</Button>
      </DialogActions>
    </Dialog>
  )
}
