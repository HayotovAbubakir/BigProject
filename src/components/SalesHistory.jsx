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
              {sells.map((s, idx) => {
                const unitPrice = s.unitPrice ?? s.unit_price ?? s.price ?? 0;
                const totalAmount = s.amount ?? s.total ?? 0;
                const currency = s.currency || 'UZS';
                const userName = s.user || s.user_name || 'Admin';
                return (
                  <TableRow key={idx}>
                    <TableCell>{s.date} {s.time || ''}</TableCell>
                    <TableCell>{s.qty}</TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>{formatMoney(unitPrice)}</TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>{formatMoney(totalAmount)}</TableCell>
                    <TableCell>{currency}</TableCell>
                    <TableCell>{userName}</TableCell>
                  </TableRow>
                );
              })}
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
