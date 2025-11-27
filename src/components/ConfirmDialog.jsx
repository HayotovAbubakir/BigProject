import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'

export default function ConfirmDialog({ open, onClose, title, children, onConfirm }) {
  return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: { xs: '1.05rem', md: '1.25rem' } }}>{title}</DialogTitle>
      <DialogContent sx={{ fontSize: { xs: '0.95rem', md: '1rem' } }}>{children}</DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ minWidth: 100 }}>Bekor</Button>
        <Button variant="contained" color="error" onClick={() => { onConfirm(); onClose() }} sx={{ minWidth: 120 }}>O'chirish</Button>
      </DialogActions>
    </Dialog>
  )
}
