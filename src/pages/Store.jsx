import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { insertLog } from '../firebase/supabaseLogs';
import {
  Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Box, Grid, TextField, Paper, IconButton, Tooltip, useTheme, useMediaQuery
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PointOfSale as SellIcon,
  History as HistoryIcon,
  Add as AddIcon,
  Store as StoreIcon,
} from '@mui/icons-material';

import { formatMoney, parseNumber } from '../utils/format';
import { useApp } from '../context/useApp';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import useExchangeRate from '../hooks/useExchangeRate';
import useDisplayCurrency from '../hooks/useDisplayCurrency';
import StoreForm from '../components/StoreForm';
import SellForm from '../components/SellForm';
import SalesHistory from '../components/SalesHistory';
import ConfirmDialog from '../components/ConfirmDialog';
import WholesaleSale from '../components/WholesaleSale';

function ProductCard({ product, onEdit, onDelete, onSell, onHistory, canAddProducts, canSell }) {
  const { t } = useLocale();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();

  return (
    <Grid item xs={12} sm={6}>
      <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6">{product.name}</Typography>
          <Typography variant="h6">{formatForDisplay(product.price, product.currency)} {displayCurrency}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">{t('qty')}: {product.qty}</Typography>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Tooltip title={t('edit')}><IconButton onClick={onEdit} disabled={!canAddProducts}><EditIcon /></IconButton></Tooltip>
          <Tooltip title={t('delete')}><IconButton onClick={onDelete} disabled={!canAddProducts} color="error"><DeleteIcon /></IconButton></Tooltip>
          <Tooltip title={t('sell')}><IconButton onClick={onSell} color="primary" disabled={!canSell}><SellIcon /></IconButton></Tooltip>
          <Tooltip title={t('history')}><IconButton onClick={onHistory} color="info"><HistoryIcon /></IconButton></Tooltip>
        </Box>
      </Paper>
    </Grid>
  );
}

export default function Store() {
  const { state, dispatch, addStoreProduct, updateStoreProduct, deleteStoreProduct } = useApp();
  const [search, setSearch] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [sellItem, setSellItem] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [openWholesale, setOpenWholesale] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null });

  const { username, hasPermission } = useAuth();
  const { t } = useLocale();
  const { rate: usdToUzs } = useExchangeRate();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const canWholesale = state.accounts?.find(a => a.username === username)?.permissions?.wholesale_allowed ?? false;
  const canAddProducts = state.accounts?.find(a => a.username === username)?.permissions?.add_products ?? false;
  const canSell = hasPermission ? !!hasPermission('wholesale_allowed') : canWholesale;

  const handleAdd = async (payload) => {
    const logData = { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username || 'Admin', action: 'product_added', kind: 'ADD', product_name: payload.name, qty: Number(payload.qty), unit_price: parseNumber(payload.price || 0), amount: Number(payload.qty) * parseNumber(payload.price || 0), currency: payload.currency || 'UZS', detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Do'konga mahsulot qo'shildi, Mahsulot: ${payload.name}, Soni: ${Number(payload.qty)}, Narx: ${parseNumber(payload.price || 0)} ${payload.currency || 'UZS'}, Jami: ${Number(payload.qty) * parseNumber(payload.price || 0)} ${payload.currency || 'UZS'}` };
    await addStoreProduct(payload, logData);
  };

  const handleEdit = async (payload) => {
    const logData = { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username || 'Admin', action: 'product_updated', kind: 'EDIT', product_name: payload.name, qty: Number(payload.qty), unit_price: parseNumber(payload.price || 0), amount: Number(payload.qty) * parseNumber(payload.price || 0), currency: payload.currency || 'UZS', detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Do'kon mahsuloti tahrirlandi, Mahsulot: ${payload.name}, Soni: ${Number(payload.qty)}, Narx: ${parseNumber(payload.price || 0)} ${payload.currency || 'UZS'}, Jami: ${Number(payload.qty) * parseNumber(payload.price || 0)} ${payload.currency || 'UZS'}` };
    await updateStoreProduct(payload.id, payload, logData);
  };

  const handleRemove = async (id) => {
    const item = state.store.find(p => p.id === id);
    const logData = { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username || 'Admin', action: 'product_deleted', kind: 'DELETE', product_name: item?.name || id, qty: Number(item?.qty || 0), unit_price: parseNumber(item?.price || 0), amount: Number(item?.qty || 0) * parseNumber(item?.price || 0), currency: item?.currency || 'UZS', detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Do'kon mahsuloti o'chirildi, Mahsulot: ${item?.name || id}, Soni: ${Number(item?.qty || 0)}, Narx: ${parseNumber(item?.price || 0)} ${item?.currency || 'UZS'}, Jami: ${Number(item?.qty || 0) * parseNumber(item?.price || 0)} ${item?.currency || 'UZS'}` };
    await deleteStoreProduct(id, logData);
  };

  const handleSell = async ({ id, qty }) => {
    const item = state.store.find(s => s.id === id);
    const price = parseNumber(item?.price || 0);
    const amount = Number(qty) * price;
    const rateText = (item?.currency === 'USD' && usdToUzs) ? `, ${t('rate_text', { rate: Math.round(usdToUzs) })}` : '';
    const log = { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user: username || 'Admin', action: 'product_sold', kind: 'SELL', productName: item?.name || id, productId: id, qty, unit_price: price, amount: amount, currency: item?.currency || 'UZS', total_uzs: Math.round(amount * (item?.currency === 'USD' && usdToUzs ? usdToUzs : 1)), detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Mahsulot sotildi, Mahsulot: ${item?.name || id}, Soni: ${qty}, Narx: ${price} ${item?.currency || 'UZS'}, Jami: ${amount} ${item?.currency || 'UZS'}${rateText}`, source: 'store' };
    dispatch({ type: 'SELL_STORE', payload: { id, qty }, log });
    try { await insertLog(log) } catch (e) { console.warn('insertLog failed (sell store)', e) }
  };

  const filteredStore = state.store.filter(it => !search || it.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{t('store')}</Typography>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditItem(null); setOpenForm(true); }} disabled={!canAddProducts}>{t('add_product')}</Button>
          <Button variant="outlined" startIcon={<StoreIcon />} onClick={() => setOpenWholesale(true)} disabled={!canWholesale}>{t('wholesale_sale')}</Button>
          <TextField size="small" placeholder={t('search_item') || 'Search...'} value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ml: 'auto' }} />
        </Box>

        {isMobile ? (
          <Grid container spacing={2}>
            {filteredStore.map(it => (
              <ProductCard
                key={it.id}
                product={it}
                onEdit={() => { setEditItem(it); setOpenForm(true); }}
                onDelete={() => setConfirm({ open: true, id: it.id })}
                onSell={() => { if (!canSell) { window.alert(t('permissionDenied')||'Permission denied'); return } setSellItem(it) }}
                onHistory={() => setHistoryFor(it)}
                canAddProducts={canAddProducts}
                canSell={canSell}
              />
            ))}
          </Grid>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('name')}</TableCell>
                  <TableCell align="center">{t('qty')}</TableCell>
                  <TableCell align="right">{t('price')}</TableCell>
                  <TableCell>{t('arrived_date')}</TableCell>
                  <TableCell>{t('note')}</TableCell>
                  <TableCell align="right">{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredStore.map((it) => (
                  <TableRow key={it.id} hover>
                    <TableCell>{it.name}</TableCell>
                    <TableCell align="center">{it.qty}</TableCell>
                    <TableCell align="right">
                      {formatForDisplay(it.price, it.currency)} {displayCurrency}
                    </TableCell>
                    <TableCell>{it.date}</TableCell>
                    <TableCell>{it.note}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('edit')}><IconButton onClick={() => { setEditItem(it); setOpenForm(true); }} disabled={!canAddProducts}><EditIcon /></IconButton></Tooltip>
                      <Tooltip title={t('delete')}><IconButton onClick={() => setConfirm({ open: true, id: it.id })} disabled={!canAddProducts} color="error"><DeleteIcon /></IconButton></Tooltip>
                      <Tooltip title={t('sell')}><IconButton onClick={() => { if (!canSell) { window.alert(t('permissionDenied')||'Permission denied'); return } setSellItem(it) }} color="primary" disabled={!canSell}><SellIcon /></IconButton></Tooltip>
                      <Tooltip title={t('history')}><IconButton onClick={() => setHistoryFor(it)} color="info"><HistoryIcon /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <StoreForm open={openForm} onClose={() => setOpenForm(false)} initial={editItem} onSubmit={(p) => editItem ? handleEdit(p) : handleAdd(p)} />
      <SellForm open={!!sellItem} initial={sellItem} onClose={() => setSellItem(null)} onSubmit={(payload) => { handleSell(payload); setSellItem(null) }} />
      <WholesaleSale open={openWholesale} onClose={() => setOpenWholesale(false)} source="store" />
      <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open: false, id: null })} title={t('confirm_delete_title')} onConfirm={() => { handleRemove(confirm.id); setConfirm({ open: false, id: null }); }}>
        {t('confirm_delete_body')}
      </ConfirmDialog>
      <SalesHistory open={!!historyFor} onClose={() => setHistoryFor(null)} sells={state.logs.filter(l => l && l.kind === 'SELL' && String(l.productId) === String(historyFor?.id)).sort((a,b)=> (b.date||'').localeCompare(a.date||'') )} />
    </Box>
  );
}