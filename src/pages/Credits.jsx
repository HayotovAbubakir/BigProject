import React, { useState, useMemo } from 'react';
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

import { parseNumber, formatMoney } from '../utils/format';
import { useApp } from '../context/useApp';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import useDisplayCurrency from '../hooks/useDisplayCurrency';
import useExchangeRate from '../hooks/useExchangeRate';
import CreditForm from '../components/CreditForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { calculateCreditTotals } from '../utils/currencyUtils';

function CreditCard({ credit, onEdit, onDelete, onComplete, isRestricted }) {
  const { t } = useLocale();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();
  const remaining = credit.remaining !== undefined ? credit.remaining : credit.amount - (credit.bosh_toluv || 0);

  // Format created_at to show date and time
  const formatDateTime = (timestamp) => {
    if (!timestamp) return credit.date || '';
    const date = new Date(timestamp);
    return date.toLocaleString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Grid item xs={12} sm={6}> 
      <Paper elevation={2} sx={{ p: { xs: 1, md: 2 }, height: '100%', position: 'relative' }}>
        {credit.completed && <Chip label={t('completed')} color="success" size="small" sx={{ position: 'absolute', top: 8, right: 8 }} />}
        <Box sx={{ mb: 1 }}>
          <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', md: '1.25rem' } }}>{credit.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
            {formatDateTime(credit.created_at)}
            {credit.created_by && ` - ${credit.created_by}`}
          </Typography>
        </Box>
        
        {credit.credit_type === 'product' && (credit.product_name || credit.productName) && (
          <Box sx={{ mb: 2, p: { xs: 1, md: 1.5 }, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>{credit.product_name || credit.productName}</Typography>
            <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, mt: 1, flexWrap: 'wrap', fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
              {(credit.qty || credit.quantity) && (
                <Typography variant="caption"><strong>Soni:</strong> {credit.qty || credit.quantity}</Typography>
              )}
              {(credit.unit_price || credit.price) && (
                <Typography variant="caption"><strong>Narxi:</strong> {(credit.unit_price || credit.price).toLocaleString()} {credit.currency || 'UZS'}</Typography>
              )}
              {credit.amount && (
                <Typography variant="caption"><strong>Jami:</strong> {credit.amount.toLocaleString()} {credit.currency || 'UZS'}</Typography>
              )}
            </Box>
          </Box>
        )}
        
        <Typography variant="h5" sx={{ my: 1, fontSize: { xs: '1.1rem', md: '1.5rem' } }}>{formatForDisplay(remaining, credit.currency)} {displayCurrency}</Typography>
        <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Izoh: {credit.note || ''}</Typography>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {!credit.completed && <Tooltip title={t('complete')}><IconButton onClick={onComplete} color="success"><CheckIcon /></IconButton></Tooltip>}
          <Tooltip title={t('edit')}><IconButton onClick={onEdit} disabled={isRestricted}><EditIcon /></IconButton></Tooltip>
          <Tooltip title={t('delete')}><IconButton onClick={onDelete} color="error" disabled={isRestricted}><DeleteIcon /></IconButton></Tooltip>
        </Box>
      </Paper>
    </Grid>
  );
}

export default function Credits() {
  const { state, addCredit, updateCredit, deleteCredit } = useApp();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('active');
  const [confirm, setConfirm] = useState({ open: false, item: null, action: null });

  const { username, user } = useAuth();
  const { t } = useLocale();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();
  const { rate: usdToUzs } = useExchangeRate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Cheklangan userlar umumiy kredits funksiyalarini ishlata olmaydi
  const isRestricted = user?.permissions?.new_account_restriction ?? false;

  const creditTotals = useMemo(() => {
    const active = calculateCreditTotals(state.credits, displayCurrency, usdToUzs, 'active');
    const completed = calculateCreditTotals(state.credits, displayCurrency, usdToUzs, 'completed');
    const all = calculateCreditTotals(state.credits, displayCurrency, usdToUzs, 'all');
    return { active, completed, all };
  }, [state.credits, displayCurrency, usdToUzs]);

  const formatDownPaymentDetail = (payload) => {
    const baseCurrency = payload?.currency || 'UZS'
    const baseValue = Number(payload?.bosh_toluv || 0)
    const originalValue = payload?.bosh_toluv_original
    const originalCurrency = payload?.bosh_toluv_currency
    if (originalValue !== undefined && originalValue !== null && originalCurrency && originalCurrency !== baseCurrency) {
      return `${baseValue} ${baseCurrency} (${originalValue} ${originalCurrency})`
    }
    return `${baseValue} ${baseCurrency}`
  }

  const handleAdd = (payload) => {
    if (isRestricted) {
      window.alert(t('new_account_restriction_message') || 'Yangi qo\'shilgan akkauntlar bu amal\'ni bajarolmaslari mumkin');
      return;
    }
    const enhancedPayload = { ...payload, created_by: username };
    const logData = { id: uuidv4(), date: payload.date || new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'credit_added', kind: 'credit', product_name: payload.product_name || payload.name, qty: payload.qty || 1, unit_price: payload.price || payload.amount, amount: payload.amount, currency: payload.currency || 'UZS', client_name: payload.name, down_payment: payload.bosh_toluv, remaining: payload.amount - payload.bosh_toluv, credit_type: payload.type, detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya qo'shildi (${payload.type === 'berilgan' ? 'berildi' : 'olingan'}), Klient: ${payload.name}, Mahsulot: ${payload.product_name}, Soni: ${payload.qty}, Narx: ${payload.price}, Jami: ${payload.amount}, Bosh to'lov: ${formatDownPaymentDetail(payload)}, Qolgan: ${payload.amount - payload.bosh_toluv} ${payload.currency}` };
    addCredit(enhancedPayload, logData);
  };

  const handleEdit = (payload) => {
    const remaining = payload.amount - (payload.bosh_toluv || 0);
    const logData = { id: uuidv4(), date: payload.date || new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'credit_updated', kind: 'CREDIT_EDIT', product_name: payload.product_name || payload.name, qty: payload.qty || 1, unit_price: payload.price || payload.amount, amount: payload.amount, currency: payload.currency || 'UZS', client_name: payload.name, down_payment: payload.bosh_toluv, remaining, credit_type: payload.type, detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya tahrirlandi (${payload.type === 'berilgan' ? 'berildi' : 'olingan'}), Klient: ${payload.name}, Mahsulot: ${payload.product_name}, Soni: ${payload.qty}, Narx: ${payload.price}, Jami: ${payload.amount}, Bosh to'lov: ${formatDownPaymentDetail(payload)}, Qolgan: ${remaining} ${payload.currency}` };
    // Do not send `remaining` to the server (it's a generated column). Send source fields instead.
    const updates = { ...payload };
    delete updates.remaining;
    updateCredit(payload.id, updates, logData);
  };

  const handleDelete = (id) => {
    const credit = state.credits.find(c => c.id === id);
    if (!credit) {
      console.error(`Credit with id ${id} not found for deletion.`);
      return;
    }
    const logData = {
      id: uuidv4(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString(),
      user_name: username,
      action: 'credit_deleted',
      kind: 'credit',
      client_name: credit?.name || credit?.client_name || id,
      product_name: credit?.product_name || credit?.name || null,
      product_id: credit?.product_id || null,
      qty: credit?.qty || 1,
      unit_price: parseNumber(credit?.unit_price || credit?.price || credit?.amount || 0),
      amount: parseNumber(credit?.amount || (credit?.qty || 1) * (credit?.unit_price || credit?.price || 0)),
      currency: credit?.currency || 'UZS',
      detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya o'chirildi (${credit?.type === 'berilgan' ? 'berilgan' : 'olingan'}), Klient: ${credit?.name || id}, ${credit?.qty ? `Miqdor: ${credit.qty}` : ''} ${credit?.product_name ? `Mahsulot: ${credit.product_name}` : ''} Narx: ${parseNumber(credit?.unit_price || credit?.price || credit?.amount || 0)} ${credit?.currency || 'UZS'}`
    };
    deleteCredit(id, logData);
  };
  
  const handleComplete = (id) => {
    const credit = state.credits.find(c => c.id === id);
    if (!credit) {
      console.error(`Credit with id ${id} not found for completion.`);
      return;
    }
    const amountVal = parseNumber(credit?.amount || ((credit?.qty || 1) * (credit?.unit_price || credit?.price || 0)));
    const updates = { completed: true, completed_at: new Date().toISOString(), completed_by: username, bosh_toluv: amountVal };
    const logData = { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'credit_closed', kind: 'credit', product_name: credit?.name, qty: 1, unit_price: parseNumber(credit?.amount || 0), amount: parseNumber(credit?.amount || 0), currency: credit?.currency || 'UZS', detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya yakunlandi (${credit?.type === 'berilgan' ? 'berilgan' : 'olingan'}), Klient: ${credit?.name}, Miqdor: ${parseNumber(credit?.amount || 0)} ${credit?.currency || 'UZS'}` };
    updateCredit(credit.id, updates, logData);
  };
  
  const filteredCredits = state.credits.filter(c => filter === 'all' ? true : (filter === 'active' ? !c.completed : c.completed));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">{t('credits')}</Typography>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box>
            <Typography variant="caption" color="textSecondary">Active Total</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {displayCurrency === 'USD' 
                ? `$${formatMoney(creditTotals.active.total)}`
                : `${formatMoney(creditTotals.active.total)} UZS`
              }
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="textSecondary">All Total</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {displayCurrency === 'USD' 
                ? `$${formatMoney(creditTotals.all.total)}`
                : `${formatMoney(creditTotals.all.total)} UZS`
              }
            </Typography>
          </Box>
        </Box>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenForm(true)} disabled={isRestricted}>{t('add_new_credit')}</Button>
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
                isRestricted={isRestricted}
                onEdit={() => setEditing(c)}
                onDelete={() => setConfirm({ open: true, item: c, action: 'delete' })}
                onComplete={() => setConfirm({ open: true, item: c, action: 'complete' })}

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
                    <TableCell align="right">{formatForDisplay(c.remaining !== undefined ? c.remaining : c.amount - (c.bosh_toluv || 0), c.currency)} {displayCurrency}</TableCell>
                    <TableCell><Chip label={c.type} size="small" color={c.type === 'olingan' ? 'error' : 'success'} variant="outlined" /></TableCell>
                    <TableCell>Izoh: {c.note || ''}</TableCell>
                    <TableCell align="right">
                      {!c.completed && <Tooltip title={t('complete')}><IconButton onClick={() => setConfirm({ open: true, item: c, action: 'complete' })} color="success"><CheckIcon /></IconButton></Tooltip>}
                        <Tooltip title={t('edit')}><IconButton onClick={() => setEditing(c)}><EditIcon /></IconButton></Tooltip>
                        <Tooltip title={t('delete')}><IconButton onClick={() => setConfirm({ open: true, item: c, action: 'delete' })} color="error"><DeleteIcon /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <CreditForm open={openForm} onClose={() => setOpenForm(false)} onSubmit={(p) => { handleAdd(p); setOpenForm(false); }} />
      <CreditForm open={!!editing} initial={editing} onClose={() => setEditing(null)} onSubmit={(p) => { handleEdit(p); setEditing(null); }} />
      <ConfirmDialog 
        open={confirm.open} 
            onClose={() => setConfirm({ open: false, item: null, action: null })} 
            title={confirm.action === 'complete' ? t('confirm_complete_credit') : t('confirm_delete_title')} 
            onConfirm={() => {
              if (confirm.action === 'complete') {
                handleComplete(confirm.item.id);
              } else {
                handleDelete(confirm.item.id);
              }
              setConfirm({ open: false, item: null, action: null });
            }}
          >
            {confirm.action === 'complete' ? t('confirm_complete_credit_body') : t('confirm_delete_body')}
          </ConfirmDialog>
    </Box>
  );
};
