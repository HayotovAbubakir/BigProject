import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Box,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  TextField,
  Divider,
  Paper,
  Stack,
  Chip,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import CloseIcon from '@mui/icons-material/Close'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'
import { v4 as uuidv4 } from 'uuid'
import useExchangeRate from '../hooks/useExchangeRate'
import useManualRate from '../hooks/useManualRate'
import { useLocale } from '../context/LocaleContext'
import { formatMoney } from '../utils/format'
import { formatProductName } from '../utils/productDisplay'
import { isMeterCategory } from '../utils/productCategories'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { insertLog } from '../firebase/supabaseLogs'
import { getProducts } from '../firebase/supabaseInventory'
import { supabase } from '/supabase/supabaseClient'
import { useNotification } from '../context/NotificationContext'

export default function WholesaleSale({ open, onClose, source = 'store', onComplete }) {
  const { state, dispatch } = useApp()
  const { user } = useAuth()
  const { rate: usdToUzs } = useExchangeRate()
  const { save: saveManualRate } = useManualRate()
  const { notify } = useNotification()
  const { t } = useLocale()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [items, setItems] = useState([])
  const [selectedSource, setSelectedSource] = useState(source)
  const [savedSelections, setSavedSelections] = useState({})
  const [isProcessing, setIsProcessing] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => () => { mountedRef.current = false }, [])

  const formatNumber = useCallback((value) => Number(value || 0).toLocaleString('en-US'), [])

  const generatePdfReceipt = useCallback((saleLines, totals, timestamp) => {
    const safeLines = saleLines || []
    const ts = timestamp || Date.now()
    const totalUsdText = formatNumber(totals?.usd || 0)
    const totalUzsText = formatNumber(totals?.uzs || 0)
    const rateText = totals?.rate ? `1 USD = ${formatNumber(totals.rate)} UZS` : null

    const job = () => {
      try {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' })
        const margin = 24

        const tableBody = safeLines.map((l) => {
          const saleUnit = l?.isMeter ? (l?.unit || 'metr') : 'dona'
          const qtyNum = Number(l?.qty || 0)
          const meterSold = l?.isMeter ? (saleUnit === 'dona' ? qtyNum * Number(l?.packQty || 0) : qtyNum) : 0
          const meterText = l?.isMeter && saleUnit === 'dona' ? ` (${formatNumber(meterSold)} m)` : ''
          const qtyLabel = `${formatNumber(qtyNum)} ${saleUnit}${meterText}`
          const unitPrice = `${formatNumber(l?.unitPrice || 0)} ${l?.currency || 'UZS'}`
          const lineTotal = `${formatNumber((l?.qty || 0) * (l?.unitPrice || 0))} ${l?.currency || 'UZS'}`
          const attrParts = []
          if (l?.category) attrParts.push(`Kategoriya: ${l.category}`)
          if (l?.electrode_size) attrParts.push(`Razmer: ${l.electrode_size}`)
          if (l?.stone_thickness) attrParts.push(`Qalinlik: ${l.stone_thickness}`)
          if (l?.stone_size) attrParts.push(`Hajmi: ${l.stone_size}`)
          const attrText = attrParts.length ? attrParts.join(' - ') : '--'
          return [
            l?.displayName || l?.name || '—',
            `${qtyLabel}\n${attrText}`,
            unitPrice,
            lineTotal,
          ]
        })

        const drawDoc = (logoImage) => {
          doc.setFontSize(14)
          doc.text('Vasta - Wholesale Receipt', margin, margin + 12)
          if (logoImage) {
            doc.addImage(logoImage, 'PNG', doc.internal.pageSize.getWidth() - margin - 64, margin, 64, 64)
          }
          doc.setFontSize(10)
          doc.text(`Date: ${new Date(ts).toLocaleString()}`, margin, margin + 30)
          doc.text(`Cashier: ${user?.username || 'Admin'}`, margin, margin + 44)

          autoTable(doc, {
            startY: margin + 60,
            head: [['Mahsulot', 'Miqdor', 'Narx', 'Jami']],
            body: tableBody,
            styles: { fontSize: 10 },
            headStyles: { fillColor: [0, 0, 0], textColor: 255 },
          })

          const endY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 16 : margin + 76
          doc.setFontSize(11)
          doc.text(`Jami (USD): ${totalUsdText}`, margin, endY)
          doc.text(`Jami (UZS): ${totalUzsText}`, margin, endY + 16)
          if (rateText) doc.text(`Kurs: ${rateText}`, margin, endY + 32)

          const name = `receipt_${new Date(ts).toISOString().slice(0,10)}.pdf`
          doc.save(name)
        }

        const logo = new Image()
        logo.crossOrigin = 'anonymous'
        logo.src = `${window.location.origin}/vasta-icon.png`
        logo.onload = () => drawDoc(logo)
        logo.onerror = () => drawDoc(null)
      } catch (err) {
        console.error('PDF generation failed', err)
      }
    }

    if (typeof window !== 'undefined' && window.setTimeout) {
      window.setTimeout(job, 0)
    } else {
      job()
    }
  }, [formatNumber, user?.username])

  // Load persisted selections once
  useEffect(() => {
    try {
      const raw = localStorage.getItem('wholesaleSelections')
      if (raw) setSavedSelections(JSON.parse(raw))
    } catch (e) { /* ignore */ }
  }, [])

  // Recompute item list when source or inventory changes
  useEffect(() => {
    const pool = selectedSource === 'warehouse' ? (state.warehouse || []) : (state.store || [])
    setItems(pool.map(p => {
      const baseName = p.name || p.title || '—'
      const displayName = formatProductName(p) || baseName
      const isMeter = isMeterCategory(p)
      const packQty = Number(p.pack_qty || 0)
      const meterQty = isMeter ? Number(p.meter_qty ?? (Number(p.qty || 0) * packQty)) : 0
      const sel = savedSelections[p.id]
      return {
        id: p.id,
        name: baseName,
        displayName,
        available: Number(p.qty || 0),
        qty: (sel && sel.qty) || '',
        unit: (sel && sel.unit) || (isMeter ? 'metr' : 'dona'),
        unitPrice: (sel && sel.unitPrice) || Number(p.price || 0),
        priceMeter: Number(p.price || 0),
        pricePiece: Number(p.price_piece || 0),
        currency: p.currency || 'UZS',
        isMeter,
        packQty,
        meterQty
      }
    }))
  }, [selectedSource, state.store, state.warehouse, savedSelections])

  const persistSelections = (next) => {
    try {
      localStorage.setItem('wholesaleSelections', JSON.stringify(next))
    } catch (e) { /* ignore */ }
  }

  const updateQty = (id, qty) => {
    setItems(it => it.map(i => i.id === id ? { ...i, qty: (qty == null ? '' : qty) } : i))
    setSavedSelections(prev => {
      const copy = { ...(prev || {}) }
      if (qty == null || qty === '' || Number(qty) <= 0) {
        delete copy[id]
      } else {
        copy[id] = { ...(copy[id] || {}), id, qty: Number(qty) }
      }
      persistSelections(copy)
      return copy
    })
  }

  const updatePrice = (id, price) => {
    setItems(it => it.map(i => i.id === id ? { ...i, unitPrice: Number(price) } : i))
    setSavedSelections(prev => {
      const copy = { ...(prev || {}) }
      copy[id] = { ...(copy[id] || {}), id, unitPrice: Number(price) }
      persistSelections(copy)
      return copy
    })
  }

  const updateUnit = (id, unit) => {
    setItems(it => it.map(i => {
      if (i.id !== id) return i
      if (!i.isMeter) return { ...i, unit }
      const nextUnitPrice = unit === 'metr'
        ? (i.priceMeter || i.unitPrice)
        : (i.pricePiece || i.unitPrice)
      return { ...i, unit, unitPrice: nextUnitPrice }
    }))
    setSavedSelections(prev => {
      const copy = { ...(prev || {}) }
      copy[id] = { ...(copy[id] || {}), id, unit }
      persistSelections(copy)
      return copy
    })
  }

  const getAvailable = (line) => {
    if (!line?.isMeter) return Number(line?.available || 0)
    if (line.unit === 'metr') return Number(line.meterQty || line.available || 0)
    return line.packQty > 0 ? Math.floor(Number(line.meterQty || line.available || 0) / line.packQty) : 0
  }

  const usedRate = usdToUzs || null

  const cartLines = Object.values(savedSelections || {}).map(sel => {
    const prod = (state.warehouse || []).concat(state.store || []).find(p => p.id === sel.id) || {}
    const isMeter = prod ? isMeterCategory(prod) : !!sel.isMeter
    const packQty = Number(prod?.pack_qty || sel.packQty || 0)
    const qtyPieces = Number(prod?.qty ?? sel.available ?? 0)
    const meterQty = isMeter ? Number(prod?.meter_qty ?? (qtyPieces * packQty)) : 0
    return {
      id: sel.id,
      displayName: prod.name || prod.title || sel.displayName || '—',
      name: prod.name || prod.title || sel.displayName || '—',
      category: prod.category || sel.category || '',
      electrode_size: prod.electrode_size || sel.electrode_size || '',
      stone_thickness: prod.stone_thickness || sel.stone_thickness || '',
      stone_size: prod.stone_size || sel.stone_size || '',
      pricePiece: prod.price_piece || sel.pricePiece || '',
      pricePack: prod.price_pack || sel.pricePack || '',
      priceMeter: prod.price || sel.priceMeter || '',
      qty: sel.qty || 0,
      unit: sel.unit || (isMeter ? 'metr' : 'dona'),
      unitPrice: sel.unitPrice || prod.price || 0,
      currency: prod.currency || sel.currency || 'UZS',
      isMeter,
      packQty,
      meterQty,
      available: isMeter ? meterQty : qtyPieces,
    }
  }).filter(l => l.qty > 0)
  
  const subtotalUsd = cartLines.reduce((s, l) => {
    const lineTotal = l.qty * l.unitPrice
    if (l.currency === 'USD') return s + lineTotal
    if (usedRate && usedRate > 0) return s + (lineTotal) / usedRate
    return s
  }, 0)
  
  const subtotalUsdRounded = Math.round(subtotalUsd * 100) / 100
  
  const subtotalUzs = cartLines.reduce((s, l) => {
    const lineTotal = l.qty * l.unitPrice
    return s + ((l.currency === 'USD') ? Math.round(lineTotal * (usedRate || 0)) : Math.round(lineTotal))
  }, 0)

  const canCheckout = cartLines.length > 0 && cartLines.every(l => {
    const available = getAvailable(l)
    if (l.isMeter && l.unit === 'dona' && l.packQty <= 0) return false
    return l.qty > 0 && l.qty <= available
  })

  const handleConfirm = async () => {
    if (!canCheckout || isProcessing) return
    setIsProcessing(true)
    if (onClose) onClose() // close instantly, API waits in background

    const ts = Date.now()

    const aggregatedProducts = cartLines.map((l) => {
      const saleUnit = l.isMeter ? (l.unit || 'metr') : 'dona'
      const packQty = Number(l.packQty || 0)
      const meterSold = l.isMeter ? (saleUnit === 'dona' ? l.qty * packQty : l.qty) : 0
      const lineTotal = Number(l.qty || 0) * Number(l.unitPrice || 0)
      return {
        id: l.id,
        name: l.displayName || l.name,
        category: l.category,
        electrode_size: l.electrode_size,
        stone_thickness: l.stone_thickness,
        stone_size: l.stone_size,
        pack_qty: l.packQty,
        meter_qty: l.meterQty,
        qty: l.qty,
        unit: saleUnit,
        meter_sold: meterSold,
        unit_price: l.unitPrice,
        currency: l.currency,
        line_total: lineTotal,
      }
    })
    const aggregatedDetail = {
      ts,
      rate: usedRate,
      total_usd: subtotalUsdRounded,
      total_uzs: subtotalUzs,
      items: aggregatedProducts,
    }
    const aggregatedLog = {
      id: uuidv4(),
      ts,
      date: new Date(ts).toISOString().slice(0,10),
      time: new Date(ts).toLocaleTimeString(),
      user_name: user?.username || 'Admin',
      action: 'wholesale_sale',
      kind: 'SELL',
      product_name: 'Wholesale bundle',
      qty: cartLines.reduce((s, l) => s + Number(l.qty || 0), 0),
      unit_price: null,
      amount: subtotalUzs,
      currency: 'UZS',
      total_uzs: subtotalUzs,
      detail: `WHOLESALE_JSON:${JSON.stringify(aggregatedDetail)}`
    }

    for (let idx = 0; idx < cartLines.length; idx++) {
      const l = cartLines[idx]
      const productInWarehouse = (state.warehouse || []).find(p => p.id === l.id)
      const productInStore = (state.store || []).find(p => p.id === l.id)
      const dispatchTarget = productInWarehouse ? 'warehouse' : (productInStore ? 'store' : selectedSource)
      const saleUnit = l.isMeter ? (l.unit || 'metr') : 'dona'
      const meterSold = l.isMeter ? (saleUnit === 'dona' ? l.qty * l.packQty : l.qty) : 0
      const payload = l.isMeter ? { id: l.id, qty: l.qty, meter_qty: meterSold } : { id: l.id, qty: l.qty }
      try {
        const prod = dispatchTarget === 'warehouse' ? productInWarehouse : productInStore
        if (!prod) throw new Error('Mahsulot topilmadi')
        const packQty = Number(prod?.pack_qty || 0)
        if (l.isMeter) {
          const baseMeter = Number(prod?.meter_qty ?? (Number(prod?.qty || 0) * packQty))
          const newMeter = Math.max(0, baseMeter - meterSold)
          const newQty = packQty > 0 ? Math.ceil(newMeter / packQty) : Math.max(0, Number(prod?.qty || 0) - (saleUnit === 'dona' ? l.qty : 0))
          const updates = { qty: newQty, meter_qty: newMeter }
          await supabase.from('products').update(updates).eq('id', l.id)
        } else {
          const newQty = Math.max(0, Number(prod?.qty || 0) - Number(l.qty))
          const updates = { qty: newQty }
          await supabase.from('products').update(updates).eq('id', l.id)
        }
      } catch (e) {
        console.warn('Supabase qty update failed (wholesale)', e)
        notify('Xato', "Optom sotuv saqlanmadi. Iltimos, qayta urinib ko'ring.", 'error')
        if (mountedRef.current) setIsProcessing(false)
        return
      }

      const logForDispatch = idx === 0 ? aggregatedLog : null
      if (dispatchTarget === 'warehouse') dispatch({ type: 'SELL_WAREHOUSE', payload, log: logForDispatch })
      else dispatch({ type: 'SELL_STORE', payload, log: logForDispatch })
    }

    try { await insertLog(aggregatedLog) } catch (e) { console.warn('insertLog failed (wholesale)', e) }

    try {
      const [wh, st] = await Promise.all([getProducts('warehouse'), getProducts('store')])
      dispatch({ type: 'SET_WAREHOUSE', payload: Array.isArray(wh) ? wh : wh?.data || [] })
      dispatch({ type: 'SET_STORE', payload: Array.isArray(st) ? st : st?.data || [] })
    } catch (e) {
      console.warn('Refetch after wholesale failed', e)
    }

    generatePdfReceipt(cartLines, { usd: subtotalUsdRounded, uzs: subtotalUzs, rate: usedRate }, ts)
  
    if (onComplete) onComplete({ lines: cartLines, subtotalUsd: subtotalUsdRounded, subtotalUzs })
    setSavedSelections({})
    try { localStorage.removeItem('wholesaleSelections') } catch (e) { /* ignore */ }
    setItems((prev) => prev.map((it) => ({ ...it, qty: '' })))
    if (mountedRef.current) setIsProcessing(false)
  }

  const surfaceBg = isDark ? theme.palette.background.default : '#f6f7fb'
  const cardBg = theme.palette.background.paper
  const cartBg = isDark
    ? 'linear-gradient(180deg,#1a1f27 0%,#0f1215 100%)'
    : 'linear-gradient(180deg,#ffffff 0%,#f0f3ff 100%)'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ sx: { backgroundColor: surfaceBg } }}
    >
      <AppBar position="static" color="default" elevation={1} sx={{ borderBottom: '1px solid #e0e3ec' }}>
        <Toolbar sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 700 }}>Optom sotuv</Typography>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="ws-source">Manba</InputLabel>
            <Select labelId="ws-source" value={selectedSource} label="Manba" onChange={(e) => setSelectedSource(e.target.value)} MenuProps={{ disablePortal: false, anchorOrigin: { vertical: 'bottom', horizontal: 'left' }, transformOrigin: { vertical: 'top', horizontal: 'left' }, PaperProps: { sx: { maxWidth: '100%', boxSizing: 'border-box' } }, disableScrollLock: true }}>
              <MenuItem value="store">Do'kon</MenuItem>
              <MenuItem value="warehouse">Ombor</MenuItem>
            </Select>
          </FormControl>
          <IconButton edge="end" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, height: isMobile ? 'auto' : 'calc(100vh - 64px)', p: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, overflow: isMobile ? 'visible' : 'hidden', display: 'flex', flexDirection: 'column', background: cardBg }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Mahsulotlar</Typography>
          <Box sx={{ flex: 1, overflowY: isMobile ? 'visible' : 'auto', pr: 1 }}>
            <Grid container spacing={1.5}>
              {items.map(it => (
                <Grid item xs={12} sm={6} md={4} key={it.id}>
                  <Box sx={{ borderRadius: 2, background: cardBg, boxShadow: isDark ? '0 10px 28px rgba(0,0,0,0.35)' : '0 6px 20px rgba(17,38,146,0.06)', p: 1.5, height: '100%', display: 'grid', gap: 0.75 }}>
                    <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{it.displayName || it.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {it.isMeter
                        ? `Mavjud: ${Number(it.meterQty || 0)} m / ${it.packQty > 0 ? Math.floor(Number(it.meterQty || 0) / it.packQty) : 0} dona`
                        : `Mavjud: ${it.available}`}
                    </Typography>
                    {it.isMeter && (
                      <FormControl fullWidth size="small">
                        <InputLabel id={`wh-unit-${it.id}`}>Birlik</InputLabel>
                        <Select
                          labelId={`wh-unit-${it.id}`}
                          value={it.unit}
                          label="Birlik"
                          onChange={(e) => updateUnit(it.id, e.target.value)}
                          size="small"
                          MenuProps={{ disablePortal: false, anchorOrigin: { vertical: 'bottom', horizontal: 'left' }, transformOrigin: { vertical: 'top', horizontal: 'left' }, PaperProps: { sx: { maxWidth: '100%', boxSizing: 'border-box' } }, disableScrollLock: true }}
                        >
                          <MenuItem value="metr">Metr</MenuItem>
                          <MenuItem value="dona">Dona</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                    <NumberField
                      label={it.isMeter ? (it.unit === 'metr' ? 'Metr' : 'Soni (dona)') : 'Soni'}
                      value={it.qty}
                      onChange={(v) => updateQty(it.id, v)}
                      fullWidth
                      sx={{ mt: 0.25 }}
                    />
                    <CurrencyField
                      label={it.isMeter ? (it.unit === 'metr' ? 'Narxi (1 metr)' : 'Narxi (1 dona)') : 'Narxi'}
                      value={it.unitPrice}
                      onChange={(v) => updatePrice(it.id, v)}
                      fullWidth
                      sx={{ mt: 0.25 }}
                      currency={it.currency}
                    />
                    <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 600 }}>
                      {it.currency === 'USD'
                        ? `Jami: ${formatNumber(it.qty * it.unitPrice)} $`
                        : `Jami: ${formatMoney(it.qty * it.unitPrice)} UZS`}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Paper>

        <Paper elevation={3} sx={{ p: 2, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1.5, background: cartBg, position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCartIcon color="primary" />
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Savatcha</Typography>
            <Chip size="small" label={cartLines.length} color="primary" variant="outlined" />
          </Box>
          <Divider />
          <TextField
            label="1 USD ="
            type="number"
            value={usdToUzs || ''}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!isNaN(v) && v > 0) saveManualRate(v)
            }}
            InputProps={{ endAdornment: <InputAdornment position="end">UZS</InputAdornment> }}
            fullWidth
            size="small"
          />

          <Box sx={{ flex: isMobile ? 'unset' : 1, overflowY: isMobile ? 'visible' : 'auto', display: 'grid', gap: 1, pr: 0.5 }}>
            {cartLines.length === 0 ? (
              <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 6, border: '1px dashed #c5c9d9', borderRadius: 2, background: cardBg }}>
                <Typography variant="body2">Hech narsa tanlanmagan</Typography>
                <Typography variant="caption">Mahsulot tanlang va miqdor kiriting</Typography>
              </Box>
            ) : (
              cartLines.map(cl => (
                <Box key={cl.id} sx={{ p: 1.25, borderRadius: 2, background: cardBg, boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.35)' : '0 8px 30px rgba(0,0,0,0.04)', display: 'grid', gap: 0.25 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography sx={{ fontWeight: 700 }}>{cl.displayName}</Typography>
                    <Chip size="small" label={`${cl.qty} ${cl.unit}`} color="primary" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {cl.currency === 'USD'
                      ? `${formatNumber(cl.qty * cl.unitPrice)} $`
                      : `${formatMoney(cl.qty * cl.unitPrice)} UZS`}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    {cl.category && <Chip size="small" label={cl.category} variant="outlined" />}
                    {cl.electrode_size && <Chip size="small" label={`Razmer: ${cl.electrode_size}`} variant="outlined" />}
                    {cl.stone_thickness && <Chip size="small" label={`Qalinlik: ${cl.stone_thickness}`} variant="outlined" />}
                  </Stack>
                  <Button
                    size="small"
                    color="error"
                    variant="text"
                    sx={{ justifySelf: 'flex-start', mt: 0.5 }}
                    onClick={() => {
                      const copy = { ...(savedSelections || {}) }
                      delete copy[cl.id]
                      try { localStorage.setItem('wholesaleSelections', JSON.stringify(copy)) } catch (e) {}
                      setSavedSelections(copy)
                      setItems(it => it.map(i => i.id === cl.id ? { ...i, qty: '' } : i))
                    }}
                  >
                    O'chirish
                  </Button>
                </Box>
              ))
            )}
          </Box>

          <Divider />
          <Box sx={{ display: 'grid', gap: 0.5 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontWeight: 600 }}>Jami (USD)</Typography>
              <Typography sx={{ fontWeight: 700 }}>{subtotalUsdRounded.toFixed(2)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontWeight: 600 }}>Jami (UZS)</Typography>
              <Typography sx={{ fontWeight: 700 }}>{formatMoney(subtotalUzs)}</Typography>
            </Stack>
          </Box>

          <Button
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={handleConfirm}
            disabled={!canCheckout || isProcessing}
            sx={{ mt: 1.5, py: 1.2, fontWeight: 700, position: isMobile ? 'static' : 'relative' }}
          >
            Tasdiqlash va Chek
          </Button>
        </Paper>
      </Box>
    </Dialog>
  )
}
