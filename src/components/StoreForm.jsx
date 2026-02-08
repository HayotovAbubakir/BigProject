import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/useApp'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, TextField, Select, MenuItem, FormControl, InputLabel } from '@mui/material'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
import CurrencyModal from './CurrencyModal'
import useExchangeRate from '../hooks/useExchangeRate'
import { v4 as uuidv4 } from 'uuid'
import { toISODate } from '../utils/date'
import { DEFAULT_PRODUCT_CATEGORIES, mergeCategories, normalizeCategory } from '../utils/productCategories'

export default function StoreForm({ open, onClose, onSubmit, initial }) {
  const { rate: usdToUzs } = useExchangeRate()
  const { state, dispatch } = useApp()
  const [form, setForm] = useState({ name: '', qty: '', price: '', price_piece: '', price_pack: '', pack_qty: '', electrode_size: '', stone_thickness: '', stone_size: '', date: '', note: '', category: '', currency: 'UZS' })
  const DRAFT_KEY_BASE = 'draft_store_'
  const getDraftKey = useCallback(() => `${DRAFT_KEY_BASE}${initial?.id || 'new'}`, [initial?.id])

  useEffect(() => {
    if (!open) return
    const key = getDraftKey()
    const saved = state?.drafts?.[key]
    
    try {
      if (saved) {
        setForm(saved)
        return
      }
    } catch {
      if (saved) {
        setForm(saved)
        return
      }
    }

    if (initial) {
      const normalizedCategory = normalizeCategory(initial.category || '')
      const piecePrice = Number(initial.price_piece ?? initial.price ?? 0)
      const packPrice = Number(initial.price_pack ?? 0)
      const packQty = Number(initial.pack_qty ?? 0)
      setForm({
        ...initial,
        date: toISODate(initial.date),
        currency: initial.currency || 'UZS',
        category: normalizedCategory,
        price: Number(initial.price ?? piecePrice ?? 0),
        price_piece: piecePrice || '',
        price_pack: packPrice || '',
        pack_qty: packQty || '',
        electrode_size: initial.electrode_size || '',
        stone_thickness: initial.stone_thickness || '',
        stone_size: initial.stone_size || ''
      })
    } else {
      setForm({ name: '', qty: '', price: '', price_piece: '', price_pack: '', pack_qty: '', electrode_size: '', stone_thickness: '', stone_size: '', date: toISODate(), note: '', category: '', currency: 'UZS' })
    }
  }, [initial, open, getDraftKey, state?.drafts])

  
  useEffect(() => {
    if (!open) return
    const key = getDraftKey()
    const t = setTimeout(() => {
      try {
        const existing = state?.drafts?.[key]
        if (JSON.stringify(existing) !== JSON.stringify(form)) {
          dispatch({ type: 'SET_DRAFT', payload: { key, value: form } })
        }
      } catch {
        dispatch({ type: 'SET_DRAFT', payload: { key, value: form } })
      }
    }, 600)
    return () => clearTimeout(t)
  }, [form, open, getDraftKey, dispatch, state?.drafts])
  

  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const handleCategory = (e) => setForm(prev => ({ ...prev, category: normalizeCategory(e.target.value) }))

  const categories = React.useMemo(() => (
    mergeCategories(state.ui?.productCategories || [], DEFAULT_PRODUCT_CATEGORIES, initial?.category, form.category)
  ), [state.ui?.productCategories, initial?.category, form.category])

  const isElectrode = normalizeCategory(form.category) === 'elektrod'
  const isStone = normalizeCategory(form.category) === 'tosh'

  const submit = () => {
    // Validation
    if (!form.name || !form.name.trim()) {
      window.alert('Mahsulot nomini kiriting')
      return
    }
    if (!form.qty || Number(form.qty) <= 0) {
      window.alert('Mahsulot sonini 0 dan katta qiling')
      return
    }
    if (isElectrode && (!form.electrode_size || !form.electrode_size.toString().trim())) {
      window.alert('Elektrod razmerini kiriting')
      return
    }
    if (!form.price || Number(form.price) <= 0) {
      window.alert('Mahsulot narxini 0 dan katta qiling')
      return
    }
    if (!form.date) {
      window.alert('Sana kiriting')
      return
    }
    
    const normalizedCategory = normalizeCategory(form.category)
    let payload = { id: initial?.id || uuidv4(), ...form, category: normalizedCategory, qty: Number(form.qty), price: Number(form.price), date: toISODate(form.date) }
    if (isElectrode) {
      payload = {
        ...payload,
        price: Number(form.price || 0),
        electrode_size: form.electrode_size ? form.electrode_size.toString().trim() : '',
        stone_thickness: null,
        stone_size: null
      }
    } else if (isStone) {
      payload = {
        ...payload,
        price: Number(form.price || 0),
        stone_thickness: form.stone_thickness ? form.stone_thickness.toString().trim() : '',
        stone_size: form.stone_size ? form.stone_size.toString().trim() : '',
        electrode_size: null
      }
    } else {
      payload = {
        ...payload,
        price: Number(form.price || 0),
        price_piece: null,
        price_pack: null,
        pack_qty: null,
        electrode_size: null,
        stone_thickness: null,
        stone_size: null
      }
    }
    try {
      if (payload.currency === 'USD' && usdToUzs) {
        payload = { ...payload, price_uzs: Number(payload.price) * Number(usdToUzs) }
      }
    } catch {
      // ignore
    }
    onSubmit(payload)
    
    try { dispatch({ type: 'CLEAR_DRAFT', payload: { key: getDraftKey() } }) } catch (err) { void err }
    onClose()
  }

  const handleClose = () => {
    
    onClose()
  }

  
  const [currencyOpenInternal, setCurrencyOpenInternal] = useState(false)
  function onCurrencyConfirmInternal({ currency }) {
    
    setForm(prev => ({ ...prev, currency }))
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '90vh' } }}>
    <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>{initial ? "Tahrirlash" : "Qo'shish"}</DialogTitle>
        <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowWrap: 'break-word', pt: { xs: 1, md: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <Button variant="outlined" size="small" onClick={() => setCurrencyOpenInternal(true)} sx={{ fontSize: { xs: '0.7rem', md: '0.875rem' }, p: { xs: '4px 8px', md: '6px 12px' } }}>{form.currency || 'UZS'}</Button>
          </Box>
          <TextField label="Nomi" fullWidth margin="dense" size="small" value={form.name} onChange={handle('name')} InputProps={{ style: { fontSize: '0.875rem' } }} />
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Kategoriya</InputLabel>
            <Select value={form.category} onChange={handleCategory} label="Kategoriya">
              <MenuItem value="">Tanlanmagan</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <NumberField label={isElectrode ? "Soni (dona)" : "Soni"} fullWidth margin="dense" value={form.qty} onChange={(v) => setForm(prev => ({ ...prev, qty: v === null ? '' : v }))} />
          {isElectrode && (
            <TextField label="Elektrod razmeri" fullWidth margin="dense" size="small" value={form.electrode_size} onChange={handle('electrode_size')} />
          )}
          {isStone && (
            <Box sx={{ mt: 1, display: 'grid', gap: 1 }}>
              <TextField label="Qalinlik razmeri" fullWidth margin="dense" size="small" value={form.stone_thickness} onChange={handle('stone_thickness')} />
              <TextField label="Hajmi" fullWidth margin="dense" size="small" value={form.stone_size} onChange={handle('stone_size')} />
            </Box>
          )}
          <CurrencyField label="Narxi" fullWidth margin="dense" value={form.price} onChange={(v) => setForm(prev => ({ ...prev, price: v === null ? '' : v }))} currency={form.currency} />
          <TextField label="Sana" fullWidth margin="dense" size="small" value={form.date} onChange={handle('date')} />
          <TextField label="Izoh" fullWidth margin="dense" size="small" value={form.note} onChange={handle('note')} InputProps={{ style: { fontSize: '0.875rem' } }} />
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
          <Button onClick={handleClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Bekor</Button>
          <Button variant="contained" onClick={submit} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>Saqlash</Button>
        </DialogActions>
      </Dialog>

      <CurrencyModal open={currencyOpenInternal} onClose={() => setCurrencyOpenInternal(false)} current={form.currency} onConfirm={onCurrencyConfirmInternal} />
    </>
  )
}
  

