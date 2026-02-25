import React from 'react'
import { Dialog, DialogTitle, DialogContent, Table, TableHead, TableRow, TableCell, TableBody, IconButton, DialogActions, Button, Typography, Stack, Chip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import useDisplayCurrency from '../hooks/useDisplayCurrency'

export default function SalesHistory({ open, onClose, sells = [] }) {
  const { displayCurrency, formatForDisplay } = useDisplayCurrency()

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <span>Sotuvlar tarixi</span>
          <Chip label={`Ko'rsatish: ${displayCurrency}`} size="small" />
        </Stack>
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
                  <TableCell>{new Intl.NumberFormat('en-US').format(Number(s.qty || 0))}</TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>
                    {formatForDisplay(s.unitPrice, s.currency)} {displayCurrency}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>
                    {formatForDisplay(s.amount, s.currency)} {displayCurrency}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{displayCurrency}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      asl: {s.currency || 'UZS'}
                    </Typography>
                  </TableCell>
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
