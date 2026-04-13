import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { useLocale } from '../context/LocaleContext'

export default function ConfirmDialog({ open, onClose, title, children, onConfirm }) {
  const { t } = useLocale()
  return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: { xs: '1.05rem', md: '1.25rem' } }}>{title}</DialogTitle>
      <DialogContent sx={{ fontSize: { xs: '0.95rem', md: '1rem' } }}>{children}</DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ minWidth: 100 }}>{t('cancel')}</Button>
        <Button variant="contained" color="error" onClick={() => { onConfirm(); onClose() }} sx={{ minWidth: 120 }}>{t('delete')}</Button>
      </DialogActions>
    </Dialog>
  )
}
