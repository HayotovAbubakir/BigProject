import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Grid, Typography, FormControl, InputLabel, Select, MenuItem, InputAdornment } from '@mui/material'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { v4 as uuidv4 } from 'uuid'
import useExchangeRate from '../hooks/useExchangeRate'
import { formatMoney } from '../utils/format'
import jsPDF from 'jspdf'

export default function WholesaleSale({ open, onClose, source = 'store', onComplete }) {
  const { state, dispatch } = useApp()
  const { user } = useAuth()
  const { rate: usdToUzs } = useExchangeRate()
  const [items, setItems] = useState([]) // { id, name, available, qty, unitPrice, currency }
  const [selectedSource, setSelectedSource] = useState(source)

  // no local rate input; use global usdToUzs

  useEffect(() => {
    const pool = selectedSource === 'warehouse' ? (state.warehouse || []) : (state.store || [])
    setItems(pool.map(p => ({ id: p.id, name: p.name || p.title || '—', available: Number(p.qty || 0), qty: 0, unitPrice: Number(p.price || p.cost || 0), currency: p.currency || 'UZS' })))
  }, [selectedSource, state.store, state.warehouse])

  const updateQty = (id, qty) => setItems(it => it.map(i => i.id === id ? { ...i, qty: Number(qty) } : i))
  const updatePrice = (id, price) => setItems(it => it.map(i => i.id === id ? { ...i, unitPrice: Number(price) } : i))

  const usedRate = usdToUzs || null

  const lines = items.filter(i => i.qty > 0)
  // subtotal in USD: sum native USD lines + convert UZS lines to USD using global rate when available
  const subtotalUsd = lines.reduce((s, l) => {
    if (l.currency === 'USD') return s + l.qty * l.unitPrice
    // l.currency === 'UZS' -> convert to USD if rate available
    if (usedRate && usedRate > 0) return s + (l.qty * l.unitPrice) / usedRate
    return s
  }, 0)
  // rounded USD total for receipt display (nearest 0.01)
  const subtotalUsdRounded = Math.round(subtotalUsd * 100) / 100
  // subtotal in UZS: sum native UZS lines + convert USD lines to UZS using global rate
  const subtotalUzs = lines.reduce((s, l) => s + ((l.currency === 'USD') ? Math.round(l.qty * l.unitPrice * (usedRate || 0)) : Math.round(l.qty * l.unitPrice)), 0)

  const canCheckout = lines.length > 0 && lines.every(l => l.qty > 0 && l.qty <= l.available)

  const handleConfirm = () => {
    if (!canCheckout) return
    // dispatch sells per-line
    const ts = Date.now()
  lines.forEach(l => {
      const payload = { id: l.id, qty: l.qty }
  const log = { id: uuidv4(), ts, date: new Date(ts).toISOString().slice(0,10), time: new Date(ts).toLocaleTimeString(), user: user?.username || 'Admin', action: 'Optom sotuv', kind: 'SELL', productId: l.id, productName: l.name, qty: l.qty, currency: l.currency }
      if (l.currency === 'USD') {
        // USD line: record USD total and UZS total if rate present
        log.total_usd = Number((l.qty * l.unitPrice).toFixed(2))
        if (usedRate) log.total_uzs = Math.round(l.qty * l.unitPrice * usedRate)
      } else {
        // UZS line: record UZS total and USD equivalent if rate available
        log.total_uzs = Math.round(l.qty * l.unitPrice)
        if (usedRate && usedRate > 0) log.total_usd = Number(((l.qty * l.unitPrice) / usedRate).toFixed(2))
      }
      // choose dispatch type based on selectedSource
      if (selectedSource === 'warehouse') {
        dispatch({ type: 'SELL_WAREHOUSE', payload, log })
      } else {
        dispatch({ type: 'SELL_STORE', payload, log })
      }
    })

    // generate a 2x2 PDF receipt (4 copies) using jsPDF
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      const boxW = (pageWidth - margin * 2) / 2
      const boxH = (pageHeight - margin * 2) / 2

      const drawReceipt = (x, y) => {
        const pad = 8
        let yPos = y + pad
        doc.setFontSize(10)
        doc.text(`Sana: ${new Date(ts).toLocaleString()}`, x + pad, yPos)
        yPos += 14
        doc.setLineWidth(0.5)
        doc.line(x + pad, yPos, x + boxW - pad, yPos)
        yPos += 12
        lines.forEach(l => {
          const lineText = `${l.name} x ${l.qty} = ${l.currency === 'USD' ? (l.qty * l.unitPrice) + ' $' : formatMoney(l.qty * l.unitPrice) + ' UZS'}`
          doc.text(lineText, x + pad, yPos)
          yPos += 12
        })
        yPos += 6
        doc.text(`Jami (USD): ${subtotalUsdRounded.toFixed(2)}`, x + pad, yPos)
        yPos += 12
        doc.text(`Jami (UZS): ${formatMoney(subtotalUzs)}`, x + pad, yPos)
      }

      // draw four receipts
      drawReceipt(margin, margin)
      drawReceipt(margin + boxW, margin)
      drawReceipt(margin, margin + boxH)
      drawReceipt(margin + boxW, margin + boxH)

      const name = `receipt_${new Date(ts).toISOString().slice(0,10)}.pdf`
      doc.save(name)
    } catch (err) {
      console.error('PDF generation failed', err)
    }

  // rate saving moved to global menu control
    onClose()
    if (onComplete) onComplete({ lines, subtotalUsd: subtotalUsdRounded, subtotalUzs })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Optom sotuv</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel id="ws-source">Manba</InputLabel>
            <Select labelId="ws-source" value={selectedSource} label="Manba" onChange={(e) => setSelectedSource(e.target.value)}>
              <MenuItem value="store">Do'kon</MenuItem>
              <MenuItem value="warehouse">Ombor</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Grid container spacing={1}>
          {items.map(it => (
            <Grid item xs={12} sm={6} md={4} key={it.id}>
              <Box sx={{ border: '1px solid rgba(0,0,0,0.06)', p: 1, borderRadius: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{it.name}</Typography>
                <Typography variant="caption">Mavjud: {it.available}</Typography>
                <TextField label="Soni" type="number" value={it.qty} onChange={(e) => updateQty(it.id, e.target.value)} fullWidth sx={{ mt: 1 }} />
                <TextField label="Narxi" type="number" value={it.unitPrice} onChange={(e) => updatePrice(it.id, e.target.value)} fullWidth sx={{ mt: 1 }} InputProps={{ endAdornment: <InputAdornment position="end">{it.currency}</InputAdornment> }} />
                <Typography variant="body2" sx={{ mt: 1 }}>{it.currency === 'USD' ? `Jami: ${it.qty * it.unitPrice} $` : `Jami: ${formatMoney(it.qty * it.unitPrice)} UZS`}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

          <Box sx={{ mt: 2 }}>
          {/* Global exchange rate used from menu */}
          <TextField label="1 USD =" type="number" value={usdToUzs || ''} InputProps={{ endAdornment: <InputAdornment position="end">UZS</InputAdornment>, readOnly: true }} fullWidth />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography>Jami (USD): {subtotalUsdRounded.toFixed(2)}</Typography>
            <Typography>Jami (UZS): {formatMoney(subtotalUzs)}</Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bekor</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={!canCheckout}>Tasdiqlash va Chek</Button>
      </DialogActions>
    </Dialog>
  )
}
