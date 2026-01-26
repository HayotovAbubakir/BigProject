import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { insertLog } from '../firebase/supabaseLogs';
import { updateAccountBalance, updateDailySales } from '../firebase/supabaseAccounts';
import { supabase } from '/supabase/supabaseClient';
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
import AddQuantityForm from '../components/AddQuantityForm';
import SalesHistory from '../components/SalesHistory';
import ConfirmDialog from '../components/ConfirmDialog';
import WholesaleSale from '../components/WholesaleSale';
import { calculateInventoryTotal } from '../utils/currencyUtils';

function ProductCard({ product, onEdit, onDelete, onSell, onHistory, onAddQty, canAddProducts, canSell }) {
  const { t } = useLocale();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();

  return (
    <Grid item xs={12} sm={6}>
      <Paper elevation={2} sx={{ p: { xs: 1, sm: 2 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontSize: { xs: '0.95rem', sm: '1.25rem' }, flex: 1, wordBreak: 'break-word' }}>{product.name}</Typography>
          <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' }, whiteSpace: 'nowrap' }}>{formatForDisplay(product.price, product.currency)} {displayCurrency}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, mb: 1 }}>{t('qty')}: {product.qty}</Typography>
        <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end', gap: 0.5, flexWrap: 'wrap-reverse' }}>
          <Tooltip title={t('edit')}><IconButton onClick={onEdit} disabled={!canAddProducts} size="small"><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('delete')}><IconButton onClick={onDelete} disabled={!canAddProducts} color="error" size="small"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Qo'shish"><IconButton onClick={onAddQty} disabled={!canAddProducts} color="success" size="small"><AddIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('sell')}><IconButton onClick={onSell} color="primary" disabled={!canSell} size="small"><SellIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('history')}><IconButton onClick={onHistory} color="info" size="small"><HistoryIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      </Paper>
    </Grid>
  );
}

export default function Store() {
  const { state, dispatch, addStoreProduct, updateStoreProduct, deleteStoreProduct, sellStoreProduct } = useApp();
  const [search, setSearch] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [sellItem, setSellItem] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [addQtyItem, setAddQtyItem] = useState(null);
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

  const inventoryValue = useMemo(() => {
    return calculateInventoryTotal([], state.store, displayCurrency, usdToUzs);
  }, [state.store, displayCurrency, usdToUzs]);

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

  const handleAddQuantity = async (payload) => {
    const item = state.store.find(p => p.id === payload.id);
    if (!item) return;
    
    const addedQty = Number(payload.qty);
    const newTotalQty = Number(item.qty) + addedQty;
    const unitPrice = parseNumber(item.price || 0);
    const amount = addedQty * unitPrice;
    
    const logData = { 
      id: uuidv4(), 
      date: new Date().toISOString().slice(0, 10), 
      time: new Date().toLocaleTimeString(), 
      user_name: username || 'Admin', 
      action: 'Mahsulot qo\'shildi', 
      kind: 'ADD_QTY', 
      product_name: item.name, 
      qty: addedQty, 
      unit_price: unitPrice, 
      currency: item.currency || 'UZS', 
      detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Do'konga mahsulot qo'shildi, Mahsulot: ${item.name}, Soni: ${addedQty}, Narx: ${unitPrice} ${item.currency || 'UZS'}, Jami: ${amount} ${item.currency || 'UZS'}` 
    };
    
    await updateStoreProduct(payload.id, { ...item, qty: newTotalQty }, logData);
  };

  const handleSell = async (payload) => {
    try {
      const { id, qty, price, currency } = payload;
      const item = state.store.find(s => s.id === id);
      if (!item) {
        console.error("Item not found in store", id);
        return;
      }

      const parsedPrice = price ? parseNumber(price) : parseNumber(item?.price || 0);
      const amount = Number(qty) * parsedPrice;
      const saleCurrency = currency || item?.currency || 'UZS';
      const rateText = (saleCurrency === 'USD' && usdToUzs) ? `, ${t('rate_text', { rate: Math.round(usdToUzs) })}` : '';
      
      // Calculate UZS amounts for accounting
      let totalUzs = 0, totalUsd = 0;
      if (saleCurrency === 'USD' && usdToUzs) {
        totalUzs = Math.round(amount * usdToUzs);
        totalUsd = amount;
      } else {
        totalUzs = Math.round(amount);
      }

      const log = { 
        id: uuidv4(), 
        date: new Date().toISOString().slice(0, 10), 
        time: new Date().toLocaleTimeString(), 
        user_name: username || 'Admin', 
        action: 'Mahsulot sotildi', 
        kind: 'SELL', 
        product_name: item?.name || id, 
        product_id: id, 
        qty, 
        unit_price: parsedPrice, 
        amount: amount, 
        currency: saleCurrency, 
        total_uzs: totalUzs,
        detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Mahsulot sotildi, Mahsulot: ${item?.name || id}, Soni: ${qty}, Narx: ${parsedPrice} ${saleCurrency}, Jami: ${amount} ${saleCurrency}${rateText}`,
        source: 'store',
      };

      console.log('[Store Sell] Processing sale:', log);

      // 1. Insert log to Supabase
      await insertLog(log);
      console.log('[Store Sell] Log inserted');

      // 2. Update product quantity in Supabase
      const newQty = Math.max(0, Number(item.qty) - Number(qty));
      const { error: qtyErr } = await supabase
        .from('products')
        .update({ qty: newQty })
        .eq('id', id);
      if (qtyErr) throw new Error(`Qty update failed: ${qtyErr.message}`);
      console.log('[Store Sell] Product qty updated:', newQty);

      // 3. Update account balance in Supabase
      await updateAccountBalance(username, totalUzs, totalUsd);
      console.log('[Store Sell] Account balance updated');

      // 4. Update daily sales in Supabase
      await updateDailySales(username, totalUzs, totalUsd);
      console.log('[Store Sell] Daily sales updated');

      // 5. Update frontend state
      dispatch({ type: 'SELL_STORE', payload: { id, qty }, log });
      setSellItem(null);

      console.log('[Store Sell] Frontend state updated');
    } catch (err) {
      console.error('[Store Sell] Error:', err);
      notify('Error', `Xato: ${err.message}`, 'error');
    }
  };

  const filteredStore = state.store.filter(it => !search || it.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">{t('store')}</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {displayCurrency === 'USD' 
              ? `Total: $${formatMoney(inventoryValue.totalInDisplay)}`
              : `Total: ${formatMoney(inventoryValue.totalInDisplay)} UZS`
            }
          </Typography>
          {displayCurrency === 'UZS' && inventoryValue.totalUsd > 0 && (
            <Typography variant="caption" color="textSecondary">
              (≈ ${formatMoney(inventoryValue.totalUsd)})
            </Typography>
          )}
          {displayCurrency === 'USD' && inventoryValue.totalUzs > 0 && (
            <Typography variant="caption" color="textSecondary">
              (≈ {formatMoney(inventoryValue.totalUzs)} UZS)
            </Typography>
          )}
        </Box>
      </Box>
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
                onAddQty={() => setAddQtyItem(it)}
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
                      <Tooltip title="Qo'shish"><IconButton onClick={() => setAddQtyItem(it)} disabled={!canAddProducts} color="success"><AddIcon /></IconButton></Tooltip>
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
      <AddQuantityForm open={!!addQtyItem} initial={addQtyItem} onClose={() => setAddQtyItem(null)} onSubmit={(payload) => { handleAddQuantity(payload); setAddQtyItem(null) }} source="store" />
      <SellForm open={!!sellItem} initial={sellItem} onClose={() => setSellItem(null)} onSubmit={(payload) => { handleSell(payload); setSellItem(null) }} />
      <WholesaleSale open={openWholesale} onClose={() => setOpenWholesale(false)} source="store" />
      <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open: false, id: null })} title={t('confirm_delete_title')} onConfirm={() => { handleRemove(confirm.id); setConfirm({ open: false, id: null }); }}>
        {t('confirm_delete_body')}
      </ConfirmDialog>
      <SalesHistory open={!!historyFor} onClose={() => setHistoryFor(null)} sells={state.logs.filter(l => l && l.kind === 'SELL' && String(l.productId) === String(historyFor?.id)).sort((a,b)=> (b.date||'').localeCompare(a.date||'') )} />
    </Box>
  );
}