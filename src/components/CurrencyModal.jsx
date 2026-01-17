import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, RadioGroup, FormControlLabel, Radio } from '@mui/material'
import { useLocale } from '../context/LocaleContext'

export default function CurrencyModal({ open, onClose, current = 'UZS', onConfirm }) {
  const [currency, setCurrency] = useState(current)
  const { t } = useLocale()

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
      <DialogTitle>{t('selectCurrency') || 'Valyuta tanlash'}</DialogTitle>
      <DialogContent>
        <RadioGroup value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <FormControlLabel value="UZS" control={<Radio />} label="UZS" />
          <FormControlLabel value="USD" control={<Radio />} label="USD" />
        </RadioGroup>
        {}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="contained" onClick={handleConfirm}>{t('save')}</Button>
      </DialogActions>
    </Dialog>
  )
}
