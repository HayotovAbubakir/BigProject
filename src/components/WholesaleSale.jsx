import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Grid, Typography, FormControl, InputLabel, Select, MenuItem, InputAdornment, TextField } from '@mui/material'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'
import { v4 as uuidv4 } from 'uuid'
import useExchangeRate from '../hooks/useExchangeRate'
import { useLocale } from '../context/LocaleContext'
import { formatMoney } from '../utils/format'
import { formatProductName } from '../utils/productDisplay'
import jsPDF from 'jspdf'
import { insertLog } from '../firebase/supabaseLogs'

export default function WholesaleSale({ open, onClose, source = 'store', onComplete }) {
  const { state, dispatch } = useApp()
  const { user } = useAuth()
  const { rate: usdToUzs } = useExchangeRate()
  const { t } = useLocale()
  const [items, setItems] = useState([]) 
  const [selectedSource, setSelectedSource] = useState(source)

  

  useEffect(() => {
    const pool = selectedSource === 'warehouse' ? (state.warehouse || []) : (state.store || [])
    setItems(pool.map(p => {
      const baseName = p.name || p.title || '—'
      const displayName = formatProductName(p) || baseName
      return { id: p.id, name: baseName, displayName, available: Number(p.qty || 0), qty: 0, unitPrice: Number(p.price || 0), currency: p.currency || 'UZS' }
    }))
  }, [selectedSource, state.store, state.warehouse])

  const updateQty = (id, qty) => setItems(it => it.map(i => i.id === id ? { ...i, qty: Number(qty) } : i))
  const updatePrice = (id, price) => setItems(it => it.map(i => i.id === id ? { ...i, unitPrice: Number(price) } : i))

  const usedRate = usdToUzs || null

  const lines = items.filter(i => i.qty > 0)
  
  const subtotalUsd = lines.reduce((s, l) => {
    if (l.currency === 'USD') return s + l.qty * l.unitPrice
    
    if (usedRate && usedRate > 0) return s + (l.qty * l.unitPrice) / usedRate
    return s
  }, 0)
  
  const subtotalUsdRounded = Math.round(subtotalUsd * 100) / 100
  
  const subtotalUzs = lines.reduce((s, l) => s + ((l.currency === 'USD') ? Math.round(l.qty * l.unitPrice * (usedRate || 0)) : Math.round(l.qty * l.unitPrice)), 0)

  const canCheckout = lines.length > 0 && lines.every(l => l.qty > 0 && l.qty <= l.available)

  const handleConfirm = async () => {
    if (!canCheckout) return
    
    const ts = Date.now()
    lines.forEach(async l => {
      const payload = { id: l.id, qty: l.qty }
        const rateText = (l.currency === 'USD' && usedRate) ? `, ${t('rate_text', { rate: Math.round(usedRate) })}` : '';
      const nameForLog = l.displayName || l.name
      const log = { id: uuidv4(), ts, date: new Date(ts).toISOString().slice(0,10), time: new Date(ts).toLocaleTimeString(), user_name: user?.username || 'Admin', action: 'wholesale_sale', kind: 'SELL', product_name: nameForLog, qty: l.qty, unit_price: l.unitPrice, amount: l.qty * l.unitPrice, currency: l.currency, total_uzs: l.currency === 'USD' ? Math.round((l.qty * l.unitPrice) * (usedRate || 1)) : Math.round(l.qty * l.unitPrice), detail: `Kim: ${user?.username || 'Admin'}, Vaqt: ${new Date(ts).toLocaleTimeString()}, Harakat: Optom sotuv, Mahsulot: ${nameForLog}, Soni: ${l.qty}, Narx: ${l.unitPrice} ${l.currency || 'UZS'}, Jami: ${l.qty * l.unitPrice} ${l.currency || 'UZS'}${rateText}` }
      
      if (selectedSource === 'warehouse') {
        dispatch({ type: 'SELL_WAREHOUSE', payload, log })
      } else {
        dispatch({ type: 'SELL_STORE', payload, log })
      }
      try { await insertLog(log) } catch (e) { console.warn('insertLog failed (wholesale)', e) }
    })

    
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
        doc.text(`Sotuvchi: ${user?.username || 'Admin'}`, x + pad, yPos)
        yPos += 14
        doc.setLineWidth(0.5)
        doc.line(x + pad, yPos, x + boxW - pad, yPos)
        yPos += 12
        lines.forEach(l => {
          const lineName = l.displayName || l.name
          const lineText = `${lineName} x ${l.qty} = ${l.currency === 'USD' ? (l.qty * l.unitPrice) + ' $' : formatMoney(l.qty * l.unitPrice) + ' UZS'}`
          doc.text(lineText, x + pad, yPos)
          yPos += 12
        })
        yPos += 6
        doc.text(`Jami (USD): ${subtotalUsdRounded.toFixed(2)}`, x + pad, yPos)
        yPos += 12
        doc.text(`Jami (UZS): ${formatMoney(subtotalUzs)}`, x + pad, yPos)
      }

      
      drawReceipt(margin, margin)
      drawReceipt(margin + boxW, margin)
      drawReceipt(margin, margin + boxH)
      drawReceipt(margin + boxW, margin + boxH)

      const name = `receipt_${new Date(ts).toISOString().slice(0,10)}.pdf`
      doc.save(name)
    } catch (err) {
      console.error('PDF generation failed', err)
    }

  
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
                <Typography sx={{ fontWeight: 600 }}>{it.displayName || it.name}</Typography>
                <Typography variant="caption">Mavjud: {it.available}</Typography>
                <NumberField label="Soni" value={it.qty} onChange={(v) => updateQty(it.id, Number(v || 0))} fullWidth sx={{ mt: 1 }} />
                <CurrencyField label="Narxi" value={it.unitPrice} onChange={(v) => updatePrice(it.id, v)} fullWidth sx={{ mt: 1 }} currency={it.currency} />
                <Typography variant="body2" sx={{ mt: 1 }}>{it.currency === 'USD' ? `Jami: ${it.qty * it.unitPrice} $` : `Jami: ${formatMoney(it.qty * it.unitPrice)} UZS`}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

          <Box sx={{ mt: 2 }}>
          {}
          <TextField label="1 USD =" type="text" value={usdToUzs || ''} InputProps={{ endAdornment: <InputAdornment position="end">UZS</InputAdornment>, readOnly: true }} fullWidth />
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
