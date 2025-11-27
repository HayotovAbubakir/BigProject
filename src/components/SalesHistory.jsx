import React from 'react'
import { Dialog, DialogTitle, DialogContent, Table, TableHead, TableRow, TableCell, TableBody, IconButton, DialogActions, Button, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { formatMoney } from '../utils/format'

export default function SalesHistory({ open, onClose, sells = [] }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Sotuvlar tarixi</span>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {sells.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Bu mahsulot uchun hali sotuv yozuvi yo'q.</Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Sana</TableCell>
                <TableCell>Soni</TableCell>
                <TableCell>Birlik narxi</TableCell>
                <TableCell>Jami</TableCell>
                <TableCell>Valyuta</TableCell>
                <TableCell>Foydalanuvchi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sells.map((s, idx) => (
                <TableRow key={idx}>
                  <TableCell>{s.date} {s.time || ''}</TableCell>
                  <TableCell>{s.qty}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{formatMoney(s.unitPrice)}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>{formatMoney(s.amount)}</TableCell>
                  <TableCell>{s.currency || 'UZS'}</TableCell>
                  <TableCell>{s.user || 'Admin'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Yopish</Button>
      </DialogActions>
    </Dialog>
  )
}
