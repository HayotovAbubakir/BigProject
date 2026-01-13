import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Table, TableHead, TableRow, TableCell, TableBody, IconButton, TextField, Box, Typography, Tooltip } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import RemoveIcon from '@mui/icons-material/Remove'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import { v4 as uuidv4 } from 'uuid'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../context/LocaleContext'
import { useNotification } from '../context/NotificationContext'
import { insertLog } from '../firebase/supabaseLogs'

export default function CreditsDialog({ open, onClose, clientId, clientName }) {
  const { state, dispatch } = useApp()
  const { username } = useAuth()
  const { t } = useLocale()
  const { showNotification } = useNotification()
  const [deductState, setDeductState] = React.useState({ id: null, value: '' })

  const credits = (state.credits || [])
    .filter(c => (!c.status || c.status !== 'completed'))
    .filter(c => !clientId || c.clientId === clientId)

  const handleDelete = (id) => {
    const credit = credits.find(c => c.id === id);
    if (!credit) return;

    const logPayload = {
      id: uuidv4(),
      user_name: username,
      action: 'CREDIT_DELETE',
      kind: 'CREDIT_DELETE',
      product_name: credit.clientName || credit.name,
      detail: `Deleted credit ${id} for client ${credit.clientName || credit.name}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString(),
      amount: credit.amount,
      currency: credit.currency,
    };
    insertLog(logPayload);
    dispatch({ type: 'DELETE_CREDIT', payload: { id }, log: { id: uuidv4(), user: username, action: 'CREDIT_DELETE', detail: `Deleted credit ${id}` } })
    showNotification(t('credit_deleted') || 'Credit deleted', 'info')
  }

  const handleDeduct = (id) => {
    const credit = (state.credits || []).find(c => c.id === id)
    if (!credit) return
    const amt = Number(deductState.value || 0)
    if (!amt || amt <= 0) return showNotification(t('enter_valid_amount') || 'Enter valid amount', 'error')
    const newRemaining = Math.max(0, Number(credit.remaining || credit.amount || 0) - amt)
    const updates = { remaining: newRemaining }
    if (newRemaining <= 0) updates.status = 'completed';

    const logPayload = {
      id: uuidv4(),
      user_name: username,
      action: 'CREDIT_DEDUCT',
      kind: 'CREDIT_DEDUCT',
      product_name: credit.clientName || credit.name,
      detail: `Deducted ${amt} from credit for ${credit.clientName || credit.name}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString(),
      amount: amt,
      currency: credit.currency,
    };
    insertLog(logPayload);

    dispatch({ type: 'EDIT_CREDIT', payload: { id, updates }, log: { id: uuidv4(), user: username, action: 'CREDIT_DEDUCT', detail: `Deducted ${amt} from credit ${credit.clientName || credit.name}` } })
    showNotification(t('credit_updated') || 'Credit updated', 'success')
    setDeductState({ id: null, value: '' })
  }

  const handleComplete = (id) => {
    const credit = (state.credits || []).find(c => c.id === id)
    if (!credit) return
    const updates = { remaining: 0, status: 'completed', completedAt: Date.now() }

    const logPayload = {
      id: uuidv4(),
      user_name: username,
      action: 'CREDIT_COMPLETE',
      kind: 'CREDIT_COMPLETE',
      product_name: credit.clientName || credit.name,
      detail: `Completed credit for ${credit.clientName || credit.name}`,
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString(),
      amount: credit.remaining,
      currency: credit.currency,
    };
    insertLog(logPayload);

    dispatch({ type: 'EDIT_CREDIT', payload: { id, updates }, log: { id: uuidv4(), user: username, action: 'CREDIT_COMPLETE', detail: `Completed credit for ${credit.clientName || credit.name}` } })
    showNotification(t('credit_completed') || 'Credit completed', 'success')
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{clientName ? `${clientName} — ${t('credits') || 'Credits'}` : (t('credits') || 'Credits')}</DialogTitle>
      <DialogContent>
        {credits.length === 0 ? (
          <Typography sx={{ py: 2 }}>{t('no_credits') || 'No active credits'}</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('client') || 'Client'}</TableCell>
                <TableCell>{t('items') || 'Items / Note'}</TableCell>
                <TableCell>{t('remaining') || 'Remaining'}</TableCell>
                <TableCell>{t('date') || 'Date'}</TableCell>
                <TableCell align="right">{t('actions') || 'Actions'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {credits.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.clientName || c.name}</TableCell>
                  <TableCell>
                    {c.creditType === 'mahsulot' ? (
                      <Box>
                        {(c.products || []).map((p, i) => (
                          <div key={i}>{p.qty} x {p.name} ({p.receiveCurrency || p.sellCurrency})</div>
                        ))}
                      </Box>
                    ) : (
                      <div>{c.note || ''}</div>
                    )}
                  </TableCell>
                  <TableCell>{(c.remaining || 0) + ' ' + (c.currency || '')}</TableCell>
                  <TableCell>{c.date || ''}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('deduct') || 'Deduct'}>
                      <IconButton size="small" onClick={() => setDeductState({ id: c.id, value: '' })}><RemoveIcon /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('complete') || 'Complete'}>
                      <IconButton size="small" onClick={() => handleComplete(c.id)}><DoneAllIcon /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('delete') || 'Delete'}>
                      <IconButton size="small" color="error" onClick={() => handleDelete(c.id)}><DeleteIcon /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {deductState.id && (
          <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
            <TextField label={t('amount') || 'Amount'} value={deductState.value} onChange={(e) => setDeductState(s => ({ ...s, value: e.target.value }))} />
            <Button variant="contained" onClick={() => handleDeduct(deductState.id)}>{t('deduct') || 'Deduct'}</Button>
            <Button onClick={() => setDeductState({ id: null, value: '' })}>{t('cancel') || 'Cancel'}</Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('close') || 'Close'}</Button>
      </DialogActions>
    </Dialog>
  )
}
