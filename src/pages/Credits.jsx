import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Typography, Button, Box, Grid, Paper, IconButton, Tooltip, useTheme, useMediaQuery, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, CardActions
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
import { formatInteger } from '../utils/format';

function StatusItem({ label, value }) {
  return (
    <Box sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  )
}

function CreditCard({ credit, onEdit, onDelete, onComplete, isRestricted }) {
  const { t } = useLocale();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();
  const remaining = credit.remaining !== undefined ? credit.remaining : credit.amount - (credit.bosh_toluv || 0);
  const initialPaid = Number(credit.bosh_toluv || 0);
  const fmt = (v) => new Intl.NumberFormat('en-US').format(Number(v || 0));
  const currencyLabel = credit.currency || 'UZS';
  const unitPrice = credit.unit_price || credit.price || 0;
  const totalAmount = credit.amount || 0;
  const displayTime = credit.time || (credit.created_at ? new Date(credit.created_at).toLocaleTimeString() : '');
  const displayDate = credit.date || (credit.created_at ? new Date(credit.created_at).toISOString().slice(0, 10) : '');

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
    <Grid item xs={12} sm={6} md={4}>
      <Card elevation={0} sx={{ position: 'relative', borderRadius: 3, height: '100%', bgcolor: '#1a1d21', border: '1px solid #2d3035', color: 'white' }}>
        {credit.completed && <Chip label={t('completed')} color="success" size="small" sx={{ position: 'absolute', top: 10, right: 10 }} />}
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 1 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, minWidth: 0, wordBreak: 'break-word' }}>
              {credit.name || t('unknown')}
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: 'gray.300' }}>{displayDate}</Typography>
              <Typography variant="caption" sx={{ color: 'gray.500', display: 'block' }}>{displayTime}</Typography>
            </Box>
          </Box>

          {/* Body */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ color: 'gray.400' }}>{t('product')}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                {credit.product_name || credit.productName || t('unknown')}
              </Typography>
              <Box sx={{ mt: 0.5, display: 'inline-flex', px: 1, py: 0.3, borderRadius: '12px', bgcolor: '#23272f', border: '1px solid #2d3035', color: 'white' }}>
                {t('qty')}: <strong style={{ marginLeft: 6 }}>{fmt(credit.qty || credit.quantity || 0)}</strong>
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
              <Typography variant="body2" sx={{ color: 'gray.400' }}>{t('unit_price')}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {fmt(unitPrice)} {currencyLabel}
              </Typography>
              <Typography variant="body2" sx={{ color: 'gray.400', mt: 0.5 }}>{t('amount')}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 800, color: '#3dd598' }}>
                {fmt(totalAmount)} {currencyLabel}
              </Typography>
            </Box>
          </Box>

          {/* Status */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, mt: 1 }}>
            <Box sx={{ p: 1, border: '1px solid #2d3035', borderRadius: 1, bgcolor: '#111317' }}>
              <Typography variant="caption" sx={{ color: 'gray.400' }}>{t('boshToluv')}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmt(initialPaid)} {currencyLabel}</Typography>
            </Box>
            <Box sx={{ p: 1, border: '1px solid #2d3035', borderRadius: 1, bgcolor: '#111317' }}>
              <Typography variant="caption" sx={{ color: 'gray.400' }}>{t('remaining')}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#ff6b6b' }}>{fmt(remaining)} {currencyLabel}</Typography>
            </Box>
            <Box sx={{ p: 1, border: '1px solid #2d3035', borderRadius: 1, bgcolor: '#111317' }}>
              <Typography variant="caption" sx={{ color: 'gray.400' }}>{t('who')}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{credit.created_by || credit.user_name || "Noma'lum"}</Typography>
            </Box>
          </Box>

          {credit.note && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('note')}: {credit.note}
            </Typography>
          )}
        </CardContent>
        <CardActions sx={{ justifyContent: 'flex-end', gap: 0.5, px: 2, pb: 2 }}>
          {!credit.completed && <Tooltip title={t('complete')}><IconButton size="small" onClick={onComplete} color="success"><CheckIcon fontSize="small" /></IconButton></Tooltip>}
          <Tooltip title={t('edit')}><IconButton size="small" onClick={onEdit} disabled={isRestricted}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('delete')}><IconButton size="small" onClick={onDelete} color="error" disabled={isRestricted}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </CardActions>
      </Card>
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
    const remainingBefore = credit?.remaining !== undefined ? credit.remaining : amountVal - parseNumber(credit?.bosh_toluv || 0);
    const updates = { completed: true, completed_at: new Date().toISOString(), completed_by: username, bosh_toluv: amountVal };
    const detailParts = [
      `Harakat: Nasiya yakunlandi`,
      `Kredit turi: ${credit?.type === 'berilgan' ? 'berilgan (berildi)' : 'olingan (olindi)'}`,
      `Klient: ${credit?.name}`,
      `Kredit berilgan sana: ${credit?.date || (credit?.created_at ? new Date(credit.created_at).toLocaleDateString('uz-UZ') : '-')}`,
      `Asl summa: ${amountVal} ${credit?.currency || 'UZS'}`,
      `Avval qolgan: ${remainingBefore} ${credit?.currency || 'UZS'}`,
      `Yakuni uchun to'langan: ${remainingBefore} ${credit?.currency || 'UZS'}`,
      `Qachon yakunlandi: ${new Date().toLocaleString('uz-UZ')}`,
      `Foydalanuvchi: ${username}`
    ];
    const logData = {
      id: uuidv4(),
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString(),
      user_name: username,
      action: 'credit_closed',
      kind: 'credit',
      product_name: credit?.name,
      qty: 1,
      unit_price: parseNumber(credit?.amount || 0),
      amount: parseNumber(credit?.amount || 0),
      currency: credit?.currency || 'UZS',
      detail: detailParts.join(', ')
    };
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
