import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Box, Grid, TextField, Paper, IconButton, Tooltip, Select, MenuItem, useTheme, useMediaQuery
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PointOfSale as SellIcon,
  LocalShipping as MoveToStoreIcon,
  Add as AddIcon,
  Store as StoreIcon,
} from '@mui/icons-material';

import { formatMoney, parseNumber } from '../utils/format';
import MoveToStoreForm from '../components/MoveToStoreForm';
import WarehouseSellForm from '../components/WarehouseSellForm';
import AddQuantityForm from '../components/AddQuantityForm';
import useExchangeRate from '../hooks/useExchangeRate';
import { useApp } from '../context/useApp';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import useDisplayCurrency from '../hooks/useDisplayCurrency';
import WarehouseForm from '../components/WarehouseForm';
import ConfirmDialog from '../components/ConfirmDialog';
import WholesaleSale from '../components/WholesaleSale';
import { calculateInventoryTotal } from '../utils/currencyUtils';
import { insertLog } from '../firebase/supabaseLogs';
import { updateAccountBalance, updateDailySales } from '../firebase/supabaseAccounts';
import { supabase } from '/supabase/supabaseClient';

function ProductCard({ product, onEdit, onDelete, onSell, onMove, onAddQty, canAddProducts, canSell, canMove }) {
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
          <Tooltip title={t('move_to_store')}><IconButton onClick={onMove} color="info" disabled={!canMove} size="small"><MoveToStoreIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      </Paper>
    </Grid>
  );
}

export default function Warehouse() {
  const { state, dispatch, addWarehouseProduct, updateWarehouseProduct, deleteWarehouseProduct } = useApp();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [moveItem, setMoveItem] = useState(null);
  const [sellItem, setSellItem] = useState(null);
  const [addQtyItem, setAddQtyItem] = useState(null);
  const [openWholesale, setOpenWholesale] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null });

  const { user, username, hasPermission } = useAuth();
  const { t } = useLocale();
  const { rate: usdToUzs } = useExchangeRate();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const canWholesale = state.accounts?.find(a => a.username === username)?.permissions?.wholesale_allowed ?? false;
  const canAddProducts = state.accounts?.find(a => a.username === username)?.permissions?.add_products ?? false;
  const canSell = hasPermission ? !!hasPermission('wholesale_allowed') : canWholesale;
  const canMove = hasPermission ? !!hasPermission('wholesale_allowed') : canWholesale;

  const inventoryValue = useMemo(() => {
    return calculateInventoryTotal(state.warehouse, [], displayCurrency, usdToUzs);
  }, [state.warehouse, displayCurrency, usdToUzs]);

  const handleAdd = async (payload) => {
    const amount = Number(payload.qty) * parseNumber(payload.price || 0);
    const logData = { id: uuidv4(), date: payload.date || new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username || 'Admin', action: t('product_added'), kind: 'ADD', product_name: payload.name, qty: Number(payload.qty), unit_price: parseNumber(payload.price || 0), currency: payload.currency || 'UZS', detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Omborga mahsulot qo'shildi, Mahsulot: ${payload.name}, Soni: ${Number(payload.qty)}, Narx: ${parseNumber(payload.price || 0)} ${payload.currency || 'UZS'}, Jami: ${amount} ${payload.currency || 'UZS'}` };
    await addWarehouseProduct(payload, logData);
  };

  const handleEdit = async (payload) => {
    const logData = { id: uuidv4(), date: payload.date || new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username || 'Admin', action: t('product_updated'), kind: 'EDIT', product_name: payload.name, qty: Number(payload.qty), unit_price: parseNumber(payload.price || 0), currency: payload.currency || 'UZS', detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Ombor mahsuloti tahrirlandi, Mahsulot: ${payload.name}, Soni: ${Number(payload.qty)}, Narx: ${parseNumber(payload.price || 0)} ${payload.currency || 'UZS'}, Jami: ${Number(payload.qty) * parseNumber(payload.price || 0)} ${payload.currency || 'UZS'}` };
    await updateWarehouseProduct(payload.id, payload, logData);
  };

  const handleRemove = async (id) => {
    const product = state.warehouse.find(p => p.id === id);
    const productName = product ? product.name : id;
    const logData = { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username || 'Admin', action: t('product_deleted'), kind: 'DELETE', product_name: productName, qty: Number(product.qty), unit_price: parseNumber(product.price || 0), currency: product.currency || 'UZS', detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Ombor mahsuloti o'chirildi, Mahsulot: ${productName}, Soni: ${Number(product.qty)}, Narx: ${parseNumber(product.price || 0)} ${product.currency || 'UZS'}, Jami: ${Number(product.qty) * parseNumber(product.price || 0)} ${product.currency || 'UZS'}` };
    await deleteWarehouseProduct(id, logData);
  };

  const handleAddQuantity = async (payload) => {
    const product = state.warehouse.find(p => p.id === payload.id);
    if (!product) return;
    
    const addedQty = Number(payload.qty);
    const newTotalQty = Number(product.qty) + addedQty;
    const unitPrice = parseNumber(product.price || 0);
    const amount = addedQty * unitPrice;
    
    const logData = { 
      id: uuidv4(), 
      date: new Date().toISOString().slice(0, 10), 
      time: new Date().toLocaleTimeString(), 
      user_name: username || 'Admin', 
      action: 'Mahsulot qo\'shildi', 
      kind: 'ADD_QTY', 
      product_name: product.name, 
      qty: addedQty, 
      unit_price: unitPrice, 
      currency: product.currency || 'UZS', 
      detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Omborga mahsulot qo'shildi, Mahsulot: ${product.name}, Soni: ${addedQty}, Narx: ${unitPrice} ${product.currency || 'UZS'}, Jami: ${amount} ${product.currency || 'UZS'}` 
    };
    
    await updateWarehouseProduct(payload.id, { ...product, qty: newTotalQty }, logData);
  };

  const filteredWarehouse = state.warehouse.filter(it => (!search || it.name.toLowerCase().includes(search.toLowerCase())) &&
    (!categoryFilter || (it.category || '').toLowerCase().includes(categoryFilter.toLowerCase())));
  const categories = [...new Set(state.warehouse.map(it => it.category).filter(Boolean))];

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2, gap: { xs: 1, sm: 0 } }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>{t('warehouse')}</Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 0.5, sm: 2 }, alignItems: { xs: 'flex-start', sm: 'center' } }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: { xs: '0.9rem', sm: '1.25rem' }, whiteSpace: 'nowrap' }}>
            {displayCurrency === 'USD' 
              ? `Total: $${formatMoney(inventoryValue.totalInDisplay)}`
              : `Total: ${formatMoney(inventoryValue.totalInDisplay)} UZS`
            }
          </Typography>
          {displayCurrency === 'UZS' && inventoryValue.totalUsd > 0 && (
            <Typography variant="caption" color="textSecondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              (≈ ${formatMoney(inventoryValue.totalUsd)})
            </Typography>
          )}
          {displayCurrency === 'USD' && inventoryValue.totalUzs > 0 && (
            <Typography variant="caption" color="textSecondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              (≈ {formatMoney(inventoryValue.totalUzs)} UZS)
            </Typography>
          )}
        </Box>
      </Box>
      <Paper sx={{ p: { xs: 1, md: 2 } }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 1, md: 2 }, alignItems: { xs: 'stretch', md: 'center' }, mb: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditItem(null); setOpenForm(true); }} disabled={!canAddProducts} sx={{ whiteSpace: 'nowrap', flex: { xs: 1, md: 'unset' } }}>{t('add_product')}</Button>
          <Button variant="outlined" startIcon={<StoreIcon />} onClick={() => setOpenWholesale(true)} disabled={!canWholesale} sx={{ whiteSpace: 'nowrap', flex: { xs: 1, md: 'unset' } }}>{t('wholesale_sale')}</Button>
          <TextField size="small" placeholder={t('search_item') || 'Search...'} value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ml: { xs: 0, md: 'auto' }, flex: { xs: 1, md: 'unset' } }} />
          <Select
            size="small"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            displayEmpty
            sx={{ mt: { xs: 1, md: 0 }, ml: { xs: 0, md: 1 }, minWidth: { xs: '100%', md: 120 } }}
          >
            <MenuItem value="">Barcha kategoriyalar</MenuItem>
            {categories.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
          </Select>
        </Box>

        {isMobile ? (
          <Grid container spacing={2}>
            {filteredWarehouse.map(it => (
              <ProductCard
                key={it.id}
                product={it}
                onEdit={() => { setEditItem(it); setOpenForm(true); }}
                onDelete={() => setConfirm({ open: true, id: it.id })}
                onAddQty={() => setAddQtyItem(it)}
                onSell={() => { if (!canSell) { window.alert(t('permissionDenied')||'Permission denied'); return } setSellItem(it) }}
                onMove={() => { if (!canMove) { window.alert(t('permissionDenied')||'Permission denied'); return } setMoveItem(it) }}
                canAddProducts={canAddProducts}
                canSell={canSell}
                canMove={canMove}
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
                {filteredWarehouse.map((it) => (
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
                        <Tooltip title={t('move_to_store')}><IconButton onClick={() => { if (!canMove) { window.alert(t('permissionDenied')||'Permission denied'); return } setMoveItem(it) }} color="info" disabled={!canMove}><MoveToStoreIcon /></IconButton></Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <WarehouseForm open={openForm} onClose={() => setOpenForm(false)} initial={editItem} onSubmit={(p) => editItem ? handleEdit(p) : handleAdd(p)} />
      <AddQuantityForm open={!!addQtyItem} initial={addQtyItem} onClose={() => setAddQtyItem(null)} onSubmit={(payload) => { handleAddQuantity(payload); setAddQtyItem(null) }} source="warehouse" />
      <MoveToStoreForm open={!!moveItem} initial={moveItem} onClose={() => setMoveItem(null)} onSubmit={(payload) => {
        const itemPrice = parseNumber(payload.item.price || 0);
        const amount = Number(payload.qty) * itemPrice;
            const moveRateText = (payload.item.currency === 'USD' && usdToUzs) ? `, ${t('rate_text', { rate: Math.round(usdToUzs) })}` : '';
        const log = { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user: username || 'Admin', action: "Ombordan do'konga o'tkazish", kind: 'MOVE', productName: payload.item.name, productId: payload.item.id, qty: Number(payload.qty), unitPrice: parseNumber(payload.item.price || 0), total: amount, currency: payload.item.currency || 'UZS', detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Ombordan do'konga o'tkazish, Mahsulot: ${payload.item.name}, Soni: ${Number(payload.qty)}, Narx: ${parseNumber(payload.item.price || 0)} ${payload.item.currency || 'UZS'}, Jami: ${amount} ${payload.item.currency || 'UZS'}${moveRateText}` };
          if (payload.item.currency === 'USD' && usdToUzs) log.total_uzs = Math.round(amount * usdToUzs);
          else log.total_uzs = Math.round(amount);
        dispatch({ type: 'MOVE_TO_STORE', payload, log });
      }} />
      <WarehouseSellForm open={!!sellItem} initial={sellItem} onClose={() => setSellItem(null)} onSubmit={async (payload) => {
        try {
          const saleQty = Number(payload.qty || 0)
          const deductQty = Number(payload.deduct_qty ?? payload.qty ?? 0)
          const saleUnit = payload.unit || 'dona'
          const packQty = Number(payload.pack_qty ?? sellItem?.pack_qty ?? 0)
          const unitPrice = parseNumber(payload.price || 0);
          const amount = saleQty * unitPrice;
          const saleCurrency = payload.currency || sellItem?.currency || 'UZS';
          const sellRateText = (saleCurrency === 'USD' && usdToUzs) ? `, ${t('rate_text', { rate: Math.round(usdToUzs) })}` : '';
          
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
            action: 'Mahsulot sotildi (ombor)', 
            kind: 'SELL', 
            product_name: sellItem?.name || '', 
            product_id: payload.id, 
            qty: saleQty, 
            unit_price: unitPrice, 
            amount: amount, 
            currency: saleCurrency, 
            total_uzs: totalUzs,
            detail: `Kim: ${username || 'Admin'}, Vaqt: ${new Date().toLocaleTimeString()}, Harakat: Ombordan mahsulot sotildi, Mahsulot: ${sellItem?.name || ''}, Soni: ${saleQty}, Narx: ${unitPrice} ${saleCurrency}, Jami: ${amount} ${saleCurrency}${sellRateText}${saleUnit === 'pachka' ? `, Birlik: pachka, Pachka: ${saleQty}, Pachkada: ${packQty}, Donalar: ${deductQty}` : ', Birlik: dona'}`,
            source: 'warehouse',
          };

          console.log('[Warehouse Sell] Processing sale:', log);

          // 1. Insert log to Supabase
          await insertLog(log);
          console.log('[Warehouse Sell] Log inserted');

          // 2. Update product quantity in Supabase
          const newQty = Math.max(0, Number(sellItem.qty) - Number(deductQty));
          const { error: qtyErr } = await supabase
            .from('products')
            .update({ qty: newQty })
            .eq('id', payload.id);
          if (qtyErr) throw new Error(`Qty update failed: ${qtyErr.message}`);
          console.log('[Warehouse Sell] Product qty updated:', newQty);

          // 3. Update account balance in Supabase
          await updateAccountBalance(username, totalUzs, totalUsd);
          console.log('[Warehouse Sell] Account balance updated');

          // 4. Update daily sales in Supabase
          await updateDailySales(username, totalUzs, totalUsd);
          console.log('[Warehouse Sell] Daily sales updated');

          // 5. Update frontend state
          dispatch({ type: 'SELL_WAREHOUSE', payload: { id: payload.id, qty: deductQty }, log });
          setSellItem(null);

          // Success notification
          const { notify } = useNotification?.() || {};
          if (notify) notify('Success', `Sotildi: ${formatMoney(totalUzs)} UZS`, 'success');

        } catch (err) {
          console.error('[Warehouse Sell] Error:', err);
          const { notify } = useNotification?.() || {};
          if (notify) notify('Error', `Xato: ${err.message}`, 'error');
        }
      }} />
      <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open: false, id: null })} title={t('confirm_delete_title')} onConfirm={() => { handleRemove(confirm.id); setConfirm({ open: false, id: null }); }}>
        {t('confirm_delete_body')}
      </ConfirmDialog>
      <WholesaleSale open={openWholesale} onClose={() => setOpenWholesale(false)} source="warehouse" />
    </Box>
  );
}
