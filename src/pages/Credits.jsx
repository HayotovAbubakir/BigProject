import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Box, Grid, Paper, IconButton, Tooltip, useTheme, useMediaQuery, Chip, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

import { formatMoney, parseNumber } from '../utils/format';
import { useApp } from '../context/useApp';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import useExchangeRate from '../hooks/useExchangeRate';
import useDisplayCurrency from '../hooks/useDisplayCurrency';
import CreditForm from '../components/CreditForm';
import ConfirmDialog from '../components/ConfirmDialog';

function CreditCard({ credit, onEdit, onDelete, onComplete, canManageCredits }) {
  const { t } = useLocale();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();
  const remaining = credit.amount - (credit.bosh_toluv || 0);

  return (
    <Grid item xs={12} sm={6}> 
      <Paper elevation={2} sx={{ p: 2, height: '100%', position: 'relative' }}>
        {credit.completed && <Chip label={t('completed')} color="success" size="small" sx={{ position: 'absolute', top: 8, right: 8 }} />}
        <Box sx={{ mb: 1 }}>
          <Typography variant="h6">{credit.name}</Typography>
          <Typography variant="body2" color="text.secondary">{credit.date}</Typography>
        </Box>
        <Typography variant="h5" sx={{ my: 1 }}>{formatForDisplay(remaining, credit.currency)} {displayCurrency}</Typography>
        <Typography variant="body2" color="text.secondary">{credit.note}</Typography>
        {canManageCredits && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {!credit.completed && <Tooltip title={t('complete')}><IconButton onClick={onComplete} color="success"><CheckIcon /></IconButton></Tooltip>}
            <Tooltip title={t('edit')}><IconButton onClick={onEdit}><EditIcon /></IconButton></Tooltip>
            <Tooltip title={t('delete')}><IconButton onClick={onDelete} color="error"><DeleteIcon /></IconButton></Tooltip>
          </Box>
        )}
      </Paper>
    </Grid>
  );
}

export default function Credits() {
  const { state, dispatch, addCredit, updateCredit, deleteCredit } = useApp();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('active');
  const [confirm, setConfirm] = useState({ open: false, id: null, action: null });
  const [completing, setCompleting] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const { username } = useAuth();
  const { t } = useLocale();
  const { rate: usdToUzs } = useExchangeRate();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { hasPermission } = useAuth();
  const canManageCredits = typeof hasPermission === 'function' ? hasPermission('credits_manage') : false;

  const handleAdd = (payload) => {
    if (!canManageCredits) return;
    const logData = { id: uuidv4(), date: payload.date || new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'credit_added', kind: 'CREDIT_ADD', product_name: payload.product_name || payload.name, qty: payload.qty || 1, unit_price: payload.price || payload.amount, amount: payload.amount, currency: payload.currency || 'UZS', client_name: payload.name, down_payment: payload.bosh_toluv, remaining: payload.amount - payload.bosh_toluv, credit_type: payload.type, detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya qo'shildi (${payload.type === 'berilgan' ? 'berildi' : 'olingan'}), Klient: ${payload.name}, Mahsulot: ${payload.product_name}, Soni: ${payload.qty}, Narx: ${payload.price}, Jami: ${payload.amount}, Bosh to'lov: ${payload.bosh_toluv}, Qolgan: ${payload.amount - payload.bosh_toluv} ${payload.currency}` };
    addCredit(payload, logData);
  };

  const handleEdit = (payload) => {
    if (!canManageCredits) return;
    const logData = { id: uuidv4(), date: payload.date || new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'credit_updated', kind: 'CREDIT_EDIT', product_name: payload.product_name || payload.name, qty: payload.qty || 1, unit_price: payload.price || payload.amount, amount: payload.amount, currency: payload.currency || 'UZS', client_name: payload.name, down_payment: payload.bosh_toluv, remaining: payload.amount - payload.bosh_toluv, credit_type: payload.type, detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya tahrirlandi (${payload.type === 'berilgan' ? 'berildi' : 'olingan'}), Klient: ${payload.name}, Mahsulot: ${payload.product_name}, Soni: ${payload.qty}, Narx: ${payload.price}, Jami: ${payload.amount}, Bosh to'lov: ${payload.bosh_toluv}, Qolgan: ${payload.amount - payload.bosh_toluv} ${payload.currency}` };
    updateCredit(payload.id, payload, logData);
  };

  const handleDelete = (id) => {
    if (!canManageCredits) return;
    const credit = state.credits.find(c => c.id === id);
    const logData = { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'credit_deleted', kind: 'CREDIT_DELETE', product_name: credit?.name || id, qty: 1, unit_price: parseNumber(credit?.amount || 0), amount: parseNumber(credit?.amount || 0), currency: credit?.currency || 'UZS', detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya o'chirildi (${credit?.type === 'berilgan' ? 'berilgan' : 'olingan'}), Klient: ${credit?.name || id}, Miqdor: ${parseNumber(credit?.amount || 0)} ${credit?.currency || 'UZS'}` };
    deleteCredit(id, logData);
    setConfirm({ open: false, id: null, action: null });
  };
  
  const handleComplete = (credit) => {
    if (!canManageCredits) return;
    const updates = { completed: true, completed_at: Date.now(), completed_by: username };
    const logData = { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'credit_closed', kind: 'CREDIT_COMPLETE', product_name: credit?.name, qty: 1, unit_price: parseNumber(credit?.amount || 0), amount: parseNumber(credit?.amount || 0), currency: credit?.currency || 'UZS', detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya yakunlandi (${credit?.type === 'berilgan' ? 'berilgan' : 'olingan'}), Klient: ${credit?.name}, Miqdor: ${parseNumber(credit?.amount || 0)} ${credit?.currency || 'UZS'}` };
    updateCredit(credit.id, updates, logData);
    setCompleting(null);
  };
  
  const filteredCredits = state.credits.filter(c => filter === 'all' ? true : (filter === 'active' ? !c.completed : c.completed));

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{t('credits')}</Typography>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenForm(true)} disabled={!canManageCredits}>{t('add_new_credit')}</Button>
          <Button variant="outlined" onClick={() => setShowCompleted(true)}>Completed Credits</Button>
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button variant={filter === 'active' ? 'contained' : 'outlined'} onClick={() => setFilter('active')}>Active</Button>
            <Button variant={filter === 'completed' ? 'contained' : 'outlined'} onClick={() => setFilter('completed')}>Completed</Button>
            <Button variant={filter === 'all' ? 'contained' : 'outlined'} onClick={() => setFilter('all')}>All</Button>
          </Box>
        </Box>

        {isMobile ? (
          <Grid container spacing={2}>
            {filteredCredits.map(c => (
              <CreditCard 
                key={c.id} 
                credit={c}
                onEdit={() => setEditing(c)}
                onDelete={() => setConfirm({ open: true, id: c.id, action: 'delete' })}
                onComplete={() => setCompleting(c)}
                canManageCredits={canManageCredits}
              />
            ))}
          </Grid>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('who')}</TableCell>
                  <TableCell>{t('date')}</TableCell>
                  <TableCell align="right">{t('amount')}</TableCell>
                  <TableCell align="right">{t('remaining')}</TableCell>
                  <TableCell>{t('type')}</TableCell>
                  <TableCell>{t('note')}</TableCell>
                  <TableCell align="right">
                    {t('actions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCredits.map((c) => (
                  <TableRow key={c.id} hover sx={{ opacity: c.completed ? 0.6 : 1 }}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.date}</TableCell>
                    <TableCell align="right">{formatForDisplay(c.amount, c.currency)} {displayCurrency}</TableCell>
                    <TableCell align="right">{formatForDisplay(c.amount - (c.bosh_toluv || 0), c.currency)} {displayCurrency}</TableCell>
                    <TableCell><Chip label={c.type} size="small" color={c.type === 'olingan' ? 'error' : 'success'} variant="outlined" /></TableCell>
                    <TableCell>{c.note}</TableCell>
                    <TableCell align="right">
                      {!c.completed && <Tooltip title={t('complete')}><IconButton onClick={() => { if (!canManageCredits) { window.alert(t('permissionDenied') || 'Permission denied'); return } setConfirm({ open: true, id: c.id, action: 'complete' }) }} color="success" disabled={!canManageCredits}><CheckIcon /></IconButton></Tooltip>}
                        <Tooltip title={t('edit')}><IconButton onClick={() => { if (!canManageCredits) { window.alert(t('permissionDenied') || 'Permission denied'); return } setEditing(c) }} disabled={!canManageCredits}><EditIcon /></IconButton></Tooltip>
                        <Tooltip title={t('delete')}><IconButton onClick={() => { if (!canManageCredits) { window.alert(t('permissionDenied') || 'Permission denied'); return } setConfirm({ open: true, id: c.id, action: 'delete' }) }} color="error" disabled={!canManageCredits}><DeleteIcon /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {canManageCredits && (
        <>
          <CreditForm open={openForm} onClose={() => setOpenForm(false)} onSubmit={(p) => { handleAdd(p); setOpenForm(false); }} />
          <CreditForm open={!!editing} initial={editing} onClose={() => setEditing(null)} onSubmit={(p) => { handleEdit(p); setEditing(null); }} />
          <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open: false, id: null, action: null })} title={confirm.action === 'complete' ? t('confirm_complete_credit') : t('confirm_delete_title')} onConfirm={() => confirm.action === 'complete' ? handleComplete(confirm.id) : handleDelete(confirm.id)}>
            {confirm.action === 'complete' ? t('confirm_complete_credit_body') : t('confirm_delete_body')}
          </ConfirmDialog>
          {completing && (
            <ConfirmDialog 
              open={!!completing} 
              onClose={() => setCompleting(null)} 
              title="Nasiyani yakunlash"
              onConfirm={() => handleComplete(completing)}
            >
              <Box sx={{ p: 2 }}>
                <Typography variant="h6">{completing.name}</Typography>
                <Typography>Jami: {formatMoney(completing.amount)} {completing.currency}</Typography>
                {completing.bosh_toluv > 0 && <Typography>Bosh to'lov: {formatMoney(completing.bosh_toluv)} {completing.currency}</Typography>}
                <Typography>To'langan: {formatMoney(completing.paid || 0)} {completing.currency}</Typography>
                <Typography>Qolgan: {formatMoney(completing.remaining !== undefined ? completing.remaining : completing.amount)} {completing.currency}</Typography>
                <Typography>Sana: {completing.date}</Typography>
                {completing.product_name && <Typography>Mahsulot: {completing.product_name}</Typography>}
                {completing.qty && <Typography>Soni: {completing.qty}</Typography>}
                {completing.price && <Typography>Narx: {formatMoney(completing.price)} {completing.currency}</Typography>}
                <Typography>Izoh: {completing.note}</Typography>
                <Typography sx={{ mt: 2, fontWeight: 'bold' }}>Haqiqatan ham yakunlashni xohlaysizmi?</Typography>
              </Box>
            </ConfirmDialog>
          )}
          <Dialog open={showCompleted} onClose={() => setShowCompleted(false)} fullWidth maxWidth="lg">
            <DialogTitle>Yakunlangan nasiyalar</DialogTitle>
            <DialogContent>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Kim</TableCell>
                    <TableCell>Sana</TableCell>
                    <TableCell align="right">Miqdor</TableCell>
                    <TableCell align="right">Bosh to'lov</TableCell>
                    <TableCell align="right">To'langan</TableCell>
                    <TableCell>Izoh</TableCell>
                    <TableCell>Yakunlangan</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {state.credits.filter(c => c.completed).map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.date}</TableCell>
                      <TableCell align="right">{formatMoney(c.amount)} {c.currency}</TableCell>
                      <TableCell align="right">{formatMoney(c.bosh_toluv || 0)} {c.currency}</TableCell>
                      <TableCell align="right">{formatMoney(c.paid || 0)} {c.currency}</TableCell>
                      <TableCell>{c.note}</TableCell>
                      <TableCell>{c.completed_at ? new Date(c.completed_at).toLocaleDateString() : 'Noma\'lum'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowCompleted(false)}>Yopish</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  );
}