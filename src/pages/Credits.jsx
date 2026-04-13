import React, { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Check as CheckIcon } from '@mui/icons-material';
import { parseNumber } from '../utils/format';
import { useApp } from '../context/useApp';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import CreditForm from '../components/CreditForm';
import ConfirmDialog from '../components/ConfirmDialog';

const safeNumber = (value) => Number(value || 0);

export default function Credits() {
  const { state, addCredit, updateCredit, deleteCredit } = useApp();
  const nasiyalar = state?.credits || [];
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('active');
  const [confirm, setConfirm] = useState({ open: false, item: null, action: null });

  const { username, user } = useAuth();
  const { t } = useLocale();

  const isRestricted = user?.permissions?.new_account_restriction ?? false;

  const totals = useMemo(() => {
    const sum = (list) =>
      list.reduce((acc, c) => {
        const qty = safeNumber(c.qty ?? c.quantity ?? 1);
        const unit = safeNumber(c.unit_price ?? c.price ?? 0);
        const amount = safeNumber(c.amount ?? qty * unit);
        return acc + amount;
      }, 0);
    return {
      active: sum(nasiyalar.filter((c) => !c.completed)),
      completed: sum(nasiyalar.filter((c) => c.completed)),
      all: sum(nasiyalar),
    };
  }, [nasiyalar]);

  const handleAdd = (payload) => {
    if (isRestricted) {
      window.alert(t('new_account_restriction_message') || 'Yangi qo\'shilgan akkauntlar bu amalni bajarolmaydi');
      return;
    }
    const amount = safeNumber(payload.amount);
    const qty = safeNumber(payload.qty || 1);
    const unitPrice = safeNumber(payload.price || payload.amount);
    const downPayment = safeNumber(payload.bosh_toluv);
    const remaining = Math.max(0, amount - downPayment);
    const enhancedPayload = { ...payload, created_by: username, credit_direction: payload.type };
    const logData = {
      id: uuidv4(),
      date: payload.date || new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString(),
      user_name: username,
      action: 'credit_added',
      kind: 'credit',
      product_name: payload.product_name || payload.name,
      qty,
      unit_price: unitPrice,
      amount,
      currency: payload.currency || 'UZS',
      client_name: payload.name,
      down_payment: downPayment,
      remaining,
      credit_type: payload.type,
      credit_direction: payload.type,
      detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya qo'shildi (${payload.type === 'berilgan' ? 'berildi' : 'olingan'}), Klient: ${payload.name}, Mahsulot: ${payload.product_name}, Soni: ${qty}, Narx: ${unitPrice}, Jami: ${amount}, Bosh to'lov: ${downPayment}, Qolgan: ${remaining} ${payload.currency || 'UZS'}`
    };
    addCredit(enhancedPayload, logData);
  };

  const handleEdit = (payload) => {
    const amount = safeNumber(payload.amount);
    const qty = safeNumber(payload.qty || 1);
    const unitPrice = safeNumber(payload.price || payload.amount);
    const downPayment = safeNumber(payload.bosh_toluv);
    const remaining = Math.max(0, amount - downPayment);
    const logData = {
      id: uuidv4(),
      date: payload.date || new Date().toISOString().slice(0, 10),
      time: new Date().toLocaleTimeString(),
      user_name: username,
      action: 'credit_updated',
      kind: 'CREDIT_EDIT',
      product_name: payload.product_name || payload.name,
      qty,
      unit_price: unitPrice,
      amount,
      currency: payload.currency || 'UZS',
      client_name: payload.name,
      down_payment: downPayment,
      remaining,
      credit_type: payload.type,
      credit_direction: payload.type,
      detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya tahrirlandi (${payload.type === 'berilgan' ? 'berildi' : 'olingan'}), Klient: ${payload.name}, Mahsulot: ${payload.product_name}, Soni: ${qty}, Narx: ${unitPrice}, Jami: ${amount}, Bosh to'lov: ${downPayment}, Qolgan: ${remaining} ${payload.currency || 'UZS'}`
    };
    const updates = { ...payload, credit_direction: payload.type };
    delete updates.remaining;
    updateCredit(payload.id, updates, logData);
  };

  const handleDelete = (id) => {
    const credit = nasiyalar.find((c) => c.id === id);
    if (!credit) return;
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
      detail: `Kim: ${username}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Nasiya o'chirildi (${credit?.type === 'berilgan' ? 'berilgan' : 'olingan'}), Klient: ${credit?.name || id}, Narx: ${parseNumber(credit?.unit_price || credit?.price || credit?.amount || 0)} ${credit?.currency || 'UZS'}`
    };
    deleteCredit(id, logData);
  };

  const handleComplete = (id) => {
    const credit = nasiyalar.find((c) => c.id === id);
    if (!credit) return;
    const amountVal = parseNumber(credit?.amount || ((credit?.qty || 1) * (credit?.unit_price || credit?.price || 0)));
    const remainingBefore = credit?.remaining !== undefined ? credit.remaining : amountVal - parseNumber(credit?.bosh_toluv || 0);
    const updates = { completed: true, completed_at: new Date().toISOString(), completed_by: username, bosh_toluv: amountVal };
    const detailParts = [
      `Harakat: Nasiya yakunlandi`,
      `Klient: ${credit?.name}`,
      `Asl summa: ${amountVal} ${credit?.currency || 'UZS'}`,
      `Avval qolgan: ${remainingBefore} ${credit?.currency || 'UZS'}`,
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

  const filteredCredits = nasiyalar.filter((c) => {
    if (filter === 'completed') return c.completed;
    if (filter === 'active') return !c.completed;
    return true;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">{t('credits')}</Typography>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box>
            <Typography variant="caption" color="textSecondary">Active Total</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{totals.active}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="textSecondary">Completed Total</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{totals.completed}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="textSecondary">All Total</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{totals.all}</Typography>
          </Box>
        </Box>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenForm(true)} disabled={isRestricted}>
            {t('add_new_credit')}
          </Button>
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            <Button variant={filter === 'active' ? 'contained' : 'outlined'} onClick={() => setFilter('active')}>Active</Button>
            <Button variant={filter === 'completed' ? 'contained' : 'outlined'} onClick={() => setFilter('completed')}>Completed</Button>
            <Button variant={filter === 'all' ? 'contained' : 'outlined'} onClick={() => setFilter('all')}>All</Button>
          </Box>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('client') || 'Client'}</TableCell>
                <TableCell>{t('product') || 'Product'}</TableCell>
                <TableCell>{t('qty') || 'Qty'}</TableCell>
                <TableCell>{t('unit_price') || 'Unit Price'}</TableCell>
                <TableCell>{t('amount') || 'Amount'}</TableCell>
                <TableCell>{t('boshToluv') || 'Paid'}</TableCell>
                <TableCell>{t('remaining') || 'Remaining'}</TableCell>
                <TableCell>{t('currency') || 'Currency'}</TableCell>
                <TableCell>{t('date') || 'Date'}</TableCell>
                <TableCell align="right">{t('actions') || 'Actions'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCredits.map((c) => {
                const qty = safeNumber(c.qty ?? c.quantity ?? 1);
                const unitPrice = safeNumber(c.unit_price ?? c.price ?? c.amount ?? 0);
                const amount = safeNumber(c.amount ?? qty * unitPrice);
                const paid = safeNumber(c.bosh_toluv);
                const remaining = c.remaining !== undefined ? safeNumber(c.remaining) : Math.max(0, amount - paid);
                const dateLabel = c.date || (c.created_at ? c.created_at.slice(0, 10) : '');
                const timeLabel = c.time || '';
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.name || c.client_name || '-'}</TableCell>
                    <TableCell>{c.product_name || c.productName || '-'}</TableCell>
                    <TableCell>{qty}</TableCell>
                    <TableCell>{unitPrice}</TableCell>
                    <TableCell>{amount}</TableCell>
                    <TableCell>{paid}</TableCell>
                    <TableCell>{remaining}</TableCell>
                    <TableCell>{c.currency || 'UZS'}</TableCell>
                    <TableCell>{dateLabel}{timeLabel ? ` ${timeLabel}` : ''}</TableCell>
                    <TableCell align="right">
                      {!c.completed && (
                        <Tooltip title={t('complete')}>
                          <IconButton size="small" color="success" onClick={() => setConfirm({ open: true, item: c, action: 'complete' })}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={t('edit')}>
                        <IconButton size="small" onClick={() => setEditing(c)} disabled={isRestricted}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('delete')}>
                        <IconButton size="small" color="error" onClick={() => setConfirm({ open: true, item: c, action: 'delete' })} disabled={isRestricted}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filteredCredits.length && (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    {t('no_data') || "Hozircha ma'lumot yo'q"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
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
}
