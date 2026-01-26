import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/useApp'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, TextField } from '@mui/material'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
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
          <NumberField label="Soni" fullWidth margin="dense" value={form.qty} onChange={(v) => setForm(prev => ({ ...prev, qty: Number(v || 0) }))} />
          <CurrencyField label="Narxi" fullWidth margin="dense" value={form.price} onChange={(v) => setForm(prev => ({ ...prev, price: v }))} currency={form.currency} />
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
  

