import React, { useState } from 'react'
import { Typography, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Button, IconButton, Snackbar, Box, Grid } from '@mui/material'
import { formatMoney, parseNumber } from '../utils/format'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import CreditForm from '../components/CreditForm'
import useExchangeRate from '../hooks/useExchangeRate'
import useDisplayCurrency from '../hooks/useDisplayCurrency'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Credits() {
  const { state, dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, id: null })
  const [snack, setSnack] = useState({ open: false, text: '' })

  const { user, username } = useAuth() 
  const { t } = useLocale() 
  const { rate: usdToUzs } = useExchangeRate()
  const { displayCurrency, formatForDisplay } = useDisplayCurrency()

  
  const acct = state.accounts?.find(a => a.username === (username || '').toLowerCase())
  const canManageCredits = acct ? !!acct.permissions?.credits_manage : (username || '').toLowerCase() !== 'shogirt'

  const handleAdd = (payload) => {
    if (!canManageCredits) {
      setSnack({ open: true, text: t('no_permission') || "Sizda ruxsat yo'qligi" })
      return
    }
    const amount = parseNumber(payload.amount || 0)
    
    let amountUsd = null
    let amountUzs = null
    if ((payload.currency || 'UZS') === 'USD') {
      amountUsd = Number(amount)
      amountUzs = usdToUzs ? Math.round(Number(amount) * usdToUzs) : (payload.amount_uzs ?? Math.round(Number(amount) || 0))
    } else {
      amountUzs = payload.amount_uzs ?? Math.round(Number(amount) || 0)
      amountUsd = usdToUzs ? Number((Number(amountUzs) / usdToUzs).toFixed(2)) : null
    }

    dispatch({ type: 'ADD_CREDIT', payload, log: { date: payload.date || new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user: username || 'Admin', action: 'Nasiya qo\'shildi', kind: 'CREDIT', name: payload.name, amount_usd: amountUsd, amount_uzs: amountUzs, currency: payload.currency || 'UZS', detail: `${payload.name} ga nasiya qo'shildi` } })
    setSnack({ open: true, text: t('credit_added') })
  }

  const handleEdit = (payload) => {
    if (!canManageCredits) {
      setSnack({ open: true, text: t('no_permission') || "Sizda ruxsat yo'qligi" })
      return
    }
    
    const amount = parseNumber(payload.amount || 0)
    let amountUsd = null
    let amountUzs = null
    if ((payload.currency || 'UZS') === 'USD') {
      amountUsd = Number(amount)
      amountUzs = usdToUzs ? Math.round(Number(amount) * usdToUzs) : (payload.amount_uzs ?? Math.round(Number(amount) || 0))
    } else {
      amountUzs = payload.amount_uzs ?? Math.round(Number(amount) || 0)
      amountUsd = usdToUzs ? Number((Number(amountUzs) / usdToUzs).toFixed(2)) : null
    }

    dispatch({ type: 'EDIT_CREDIT', payload: { id: payload.id, updates: payload }, log: { date: payload.date || new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user: username || 'Admin', action: 'Nasiya tahrirlandi', kind: 'CREDIT_EDIT', name: payload.name, amount_usd: amountUsd, amount_uzs: amountUzs, currency: payload.currency || 'UZS', detail: `${payload.name} tahrirlandi` } })
    setSnack({ open: true, text: t('credit_updated') })
  }

  const handleDelete = (id) => {
    if (!canManageCredits) {
      setSnack({ open: true, text: t('no_permission') || "Sizda ruxsat yo'qligi" })
      return
    }
  const c = state.credits.find(x => x.id === id)
  const amount = parseNumber(c?.amount || 0)
  
  const delAmountUsd = c?.currency === 'USD' ? Number(amount) : (usdToUzs ? Number((Number(c?.amount_uzs ?? amount) / usdToUzs).toFixed(2)) : null)
  const delAmountUzs = c?.currency === 'USD' ? (usdToUzs ? Math.round(Number(amount) * usdToUzs) : Number(c?.amount_uzs ?? amount)) : (c?.amount_uzs ?? Math.round(Number(amount) || 0))
  dispatch({ type: 'DELETE_CREDIT', payload: { id }, log: { date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user: username || 'Admin', action: 'Nasiya o\'chirildi', kind: 'CREDIT_DELETE', name: c?.name || id, amount_usd: delAmountUsd, amount_uzs: delAmountUzs, currency: c?.currency || 'UZS', detail: `Nasiya ${id} o'chirildi` } })
    setSnack({ open: true, text: t('credit_deleted') })
  }

  

  return (
    <Box sx={{ display: 'flex', justifyContent: 'start', alignItems:'center' }}>
  <Box sx={{ width: '100%', px: { xs: 2, sm: 2, md: 0 } }}>
      <Typography variant="h4" gutterBottom>{t('credits')}</Typography>
      <Card>
        <CardContent>
          {canManageCredits && (
            <Button variant="contained" sx={{ mb: 2, width: { xs: '100%', sm: 'auto' }, minWidth: 40, px: 1 }} onClick={() => setOpen(true)} aria-label="add">+</Button>
          )}
          <TableContainer sx={{ overflowX: 'auto', display: { xs: 'none', md: 'block' } }}>
            <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('who')}</TableCell>
                <TableCell>{t('date')}</TableCell>
                <TableCell>{t('amount')}</TableCell>
                <TableCell>{t('currency')}</TableCell>
                <TableCell>{t('type')}</TableCell>
                <TableCell>{t('note')}</TableCell>
                <TableCell>{t('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.credits.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.date}</TableCell>
                  <TableCell>
                    {(() => {
                      const displayed = formatForDisplay(c.amount, c.currency)
                      if (displayed !== null) return `${formatMoney(displayed)} ${displayCurrency}`
                      return `${formatMoney(c.amount_uzs ?? c.amount)} UZS`
                    })()}
                  </TableCell>
                  <TableCell>{c.currency}</TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell>{c.note}</TableCell>
                  <TableCell>
                    {canManageCredits && (
                      <>
                        <IconButton onClick={() => setEditing(c)}><EditIcon /></IconButton>
                        <IconButton onClick={() => setConfirm({ open: true, id: c.id })} color="error"><DeleteIcon /></IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </TableContainer>

          {}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Grid container spacing={2}>
              {state.credits.map(c => (
                <Grid item xs={12} sm={6} key={c.id}>
                  <Card>
                    <CardContent>
                      <Typography sx={{ fontWeight: 700 }}>{c.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{c.date}</Typography>
                      <Typography variant="body1" sx={{ mt: 1 }}>
                        {(() => {
                          const displayed = formatForDisplay(c.amount, c.currency)
                          if (displayed !== null) return `${formatMoney(displayed)} ${displayCurrency}`
                          return `${formatMoney(c.amount_uzs ?? c.amount)} UZS`
                        })()}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>{c.note}</Typography>
                      {canManageCredits && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <IconButton onClick={() => setEditing(c)} size="small"><EditIcon /></IconButton>
                          <IconButton onClick={() => setConfirm({ open: true, id: c.id })} color="error" size="small"><DeleteIcon /></IconButton>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {canManageCredits && (
        <>
          <CreditForm open={open} onClose={() => setOpen(false)} onSubmit={handleAdd} />
          <CreditForm open={!!editing} initial={editing} onClose={() => setEditing(null)} onSubmit={handleEdit} />
          <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open: false, id: null })} title={t('confirm_delete_title')} onConfirm={() => handleDelete(confirm.id)}>
            {t('confirm_delete_body')}
          </ConfirmDialog>
        </>
      )}
      <Snackbar open={snack.open} autoHideDuration={3000} message={snack.text} onClose={() => setSnack({ open: false, text: '' })} />
      </Box>
    </Box>
  )
}
