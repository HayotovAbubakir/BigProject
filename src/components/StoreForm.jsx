import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button, Box } from '@mui/material'
import CurrencyModal from './CurrencyModal'
import useExchangeRate from '../hooks/useExchangeRate'
import { v4 as uuidv4 } from 'uuid'
import { toISODate } from '../utils/date'

export default function StoreForm({ open, onClose, onSubmit, initial }) {
  const { rate: usdToUzs } = useExchangeRate()
  const { state, dispatch } = useApp()
  const [form, setForm] = useState({ name: '', qty: 0, price: 0, date: '', note: '', currency: 'UZS' })
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

    if (initial) setForm({ ...initial, date: toISODate(initial.date), currency: initial.currency || 'UZS' })
    else setForm({ name: '', qty: 0, price: 0, date: toISODate(), note: '', currency: 'UZS' })
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

  const submit = () => {
    
    let payload = { id: initial?.id || uuidv4(), ...form, qty: Number(form.qty), price: Number(form.price), date: toISODate(form.date) }
    try {
      if (payload.currency === 'USD' && usdToUzs) {
        payload = { ...payload, price_uzs: Number(payload.price) * Number(usdToUzs) }
      }
    } catch {
      
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
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
    <DialogTitle sx={{ fontSize: { xs: '1.05rem', md: '1.25rem' } }}>{initial ? "Do'kondagi mahsulotni tahrirlash" : "Do'konga mahsulot qo'shish"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <Button variant="outlined" onClick={() => setCurrencyOpenInternal(true)}>Valyuta: {form.currency || 'UZS'}</Button>
          </Box>
          <TextField label="Nomi" fullWidth margin="dense" value={form.name} onChange={handle('name')} />
          <TextField label="Soni" fullWidth type="number" margin="dense" value={form.qty} onChange={handle('qty')} />
          <TextField label="Narxi (do'konda)" fullWidth type="number" margin="dense" value={form.price} onChange={handle('price')} />
          <TextField label="Olingan sana" fullWidth margin="dense" value={form.date} onChange={handle('date')} />
          <TextField label="Izoh" fullWidth margin="dense" value={form.note} onChange={handle('note')} />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={handleClose} sx={{ minWidth: 100 }}>Bekor qilish</Button>
          <Button variant="contained" onClick={submit} sx={{ minWidth: 120 }}>Saqlash</Button>
        </DialogActions>
      </Dialog>

      <CurrencyModal open={currencyOpenInternal} onClose={() => setCurrencyOpenInternal(false)} current={form.currency} onConfirm={onCurrencyConfirmInternal} />
    </>
  )
}
  

