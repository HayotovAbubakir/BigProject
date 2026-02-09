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
import { isMeterCategory } from '../utils/productCategories'
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
      const isMeter = isMeterCategory(p.category)
      const packQty = Number(p.pack_qty || 0)
      const meterQty = isMeter ? Number(p.meter_qty ?? (Number(p.qty || 0) * packQty)) : 0
      return {
        id: p.id,
        name: baseName,
        displayName,
        available: Number(p.qty || 0),
        qty: 0,
        unit: isMeter ? 'metr' : 'dona',
        unitPrice: Number(p.price || 0),
        priceMeter: Number(p.price || 0),
        pricePiece: Number(p.price_piece || 0),
        currency: p.currency || 'UZS',
        isMeter,
        packQty,
        meterQty
      }
    }))
  }, [selectedSource, state.store, state.warehouse])

  const updateQty = (id, qty) => setItems(it => it.map(i => i.id === id ? { ...i, qty: Number(qty) } : i))
  const updatePrice = (id, price) => setItems(it => it.map(i => i.id === id ? { ...i, unitPrice: Number(price) } : i))
  const updateUnit = (id, unit) => setItems(it => it.map(i => {
    if (i.id !== id) return i
    if (!i.isMeter) return { ...i, unit }
    const nextUnitPrice = unit === 'metr'
      ? (i.priceMeter || i.unitPrice)
      : (i.pricePiece || i.unitPrice)
    return { ...i, unit, unitPrice: nextUnitPrice }
  }))

  const getAvailable = (line) => {
    if (!line.isMeter) return Number(line.available || 0)
    if (line.unit === 'metr') return Number(line.meterQty || 0)
    return line.packQty > 0 ? Math.floor(Number(line.meterQty || 0) / line.packQty) : 0
  }

  const usedRate = usdToUzs || null

  const lines = items.filter(i => i.qty > 0)
  
  const subtotalUsd = lines.reduce((s, l) => {
    const lineTotal = l.qty * l.unitPrice
    if (l.currency === 'USD') return s + lineTotal
    
    if (usedRate && usedRate > 0) return s + (lineTotal) / usedRate
    return s
  }, 0)
  
  const subtotalUsdRounded = Math.round(subtotalUsd * 100) / 100
  
  const subtotalUzs = lines.reduce((s, l) => {
    const lineTotal = l.qty * l.unitPrice
    return s + ((l.currency === 'USD') ? Math.round(lineTotal * (usedRate || 0)) : Math.round(lineTotal))
  }, 0)

  const canCheckout = lines.length > 0 && lines.every(l => {
    const available = getAvailable(l)
    if (l.isMeter && l.unit === 'dona' && l.packQty <= 0) return false
    return l.qty > 0 && l.qty <= available
  })

  const handleConfirm = async () => {
    if (!canCheckout) return
    
    const ts = Date.now()
    lines.forEach(async l => {
      const saleUnit = l.isMeter ? (l.unit || 'metr') : 'dona'
      const meterSold = l.isMeter ? (saleUnit === 'dona' ? l.qty * l.packQty : l.qty) : 0
      const payload = l.isMeter ? { id: l.id, qty: l.qty, meter_qty: meterSold } : { id: l.id, qty: l.qty }
      const rateText = (l.currency === 'USD' && usedRate) ? `, ${t('rate_text', { rate: Math.round(usedRate) })}` : '';
      const nameForLog = l.displayName || l.name
      const lineTotal = l.qty * l.unitPrice
      const priceLabel = l.isMeter
        ? (saleUnit === 'dona' ? `Narx (1 dona): ${l.unitPrice} ${l.currency || 'UZS'}` : `Narx (1 metr): ${l.unitPrice} ${l.currency || 'UZS'}`)
        : `Narx: ${l.unitPrice} ${l.currency || 'UZS'}`
      const meterLabel = l.isMeter ? `, Metr: ${meterSold} m` : ''
      const unitLabel = l.isMeter ? `, Birlik: ${saleUnit}` : ''
      const qtyForLog = l.isMeter ? meterSold : l.qty
      const log = { id: uuidv4(), ts, date: new Date(ts).toISOString().slice(0,10), time: new Date(ts).toLocaleTimeString(), user_name: user?.username || 'Admin', action: 'wholesale_sale', kind: 'SELL', product_name: nameForLog, qty: qtyForLog, unit_price: l.unitPrice, amount: lineTotal, currency: l.currency, total_uzs: l.currency === 'USD' ? Math.round(lineTotal * (usedRate || 1)) : Math.round(lineTotal), detail: `Kim: ${user?.username || 'Admin'}, Vaqt: ${new Date(ts).toLocaleTimeString()}, Harakat: Optom sotuv, Mahsulot: ${nameForLog}, Soni: ${l.qty}${meterLabel}${unitLabel}, ${priceLabel}, Jami: ${lineTotal} ${l.currency || 'UZS'}${rateText}` }
      
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
          const saleUnit = l.isMeter ? (l.unit || 'metr') : 'dona'
          const meterSold = l.isMeter ? (saleUnit === 'dona' ? l.qty * l.packQty : l.qty) : 0
          const lineTotal = l.qty * l.unitPrice
          const unitText = l.isMeter ? (saleUnit === 'metr' ? ' m' : ' dona') : ''
          const meterText = l.isMeter && saleUnit === 'dona' ? ` (${meterSold} m)` : ''
          const lineText = `${lineName} x ${l.qty}${unitText}${meterText} = ${l.currency === 'USD' ? (lineTotal) + ' $' : formatMoney(lineTotal) + ' UZS'}`
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
                <Typography variant="caption">
                  {it.isMeter
                    ? `Mavjud: ${Number(it.meterQty || 0)} m / ${it.packQty > 0 ? Math.floor(Number(it.meterQty || 0) / it.packQty) : 0} dona`
                    : `Mavjud: ${it.available}`}
                </Typography>
                {it.isMeter && (
                  <FormControl fullWidth sx={{ mt: 1 }}>
                    <InputLabel id={`wh-unit-${it.id}`}>Birlik</InputLabel>
                    <Select
                      labelId={`wh-unit-${it.id}`}
                      value={it.unit}
                      label="Birlik"
                      onChange={(e) => updateUnit(it.id, e.target.value)}
                      size="small"
                    >
                      <MenuItem value="metr">Metr</MenuItem>
                      <MenuItem value="dona">Dona</MenuItem>
                    </Select>
                  </FormControl>
                )}
                <NumberField
                  label={it.isMeter ? (it.unit === 'metr' ? 'Metr' : 'Soni (dona)') : 'Soni'}
                  value={it.qty}
                  onChange={(v) => updateQty(it.id, Number(v || 0))}
                  fullWidth
                  sx={{ mt: 1 }}
                />
                <CurrencyField
                  label={it.isMeter ? (it.unit === 'metr' ? 'Narxi (1 metr)' : 'Narxi (1 dona)') : 'Narxi'}
                  value={it.unitPrice}
                  onChange={(v) => updatePrice(it.id, v)}
                  fullWidth
                  sx={{ mt: 1 }}
                  currency={it.currency}
                />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {it.currency === 'USD'
                    ? `Jami: ${it.qty * it.unitPrice} $`
                    : `Jami: ${formatMoney(it.qty * it.unitPrice)} UZS`}
                </Typography>
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
