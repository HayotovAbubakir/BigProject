import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box, Typography, Button, Grid, Paper, IconButton, Tooltip, TextField,
  Dialog, DialogActions, DialogContent, DialogTitle, Avatar, List, ListItem, ListItemText, useMediaQuery, useTheme, Select, MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CreditCard as CreditCardIcon,
  AddCard as AddCardIcon
} from '@mui/icons-material';
import { useApp } from '../context/useApp';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import { useNotification } from '../context/NotificationContext';
import ConfirmDialog from '../components/ConfirmDialog';
import CreditsDialog from '../components/CreditsDialog';
import { insertLog } from '../firebase/supabaseLogs';
// Note: The credit management dialogs and logic are complex and are kept as is to avoid breaking functionality.
// Only the main client list UI is redesigned.

function ClientCard({ client, onAddCredit, onViewCredits, onEdit, onDelete, canManageCredits }) {
  const { t } = useLocale();
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>{client.name.charAt(0)}</Avatar>
          <Box>
            <Typography variant="h6">{client.name}</Typography>
            <Typography variant="body2" color="text.secondary">{client.phone}</Typography>
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Tooltip title={t('viewCredits')}><IconButton onClick={onViewCredits}><CreditCardIcon /></IconButton></Tooltip>
          <Tooltip title={t('addCredit')}><IconButton onClick={onAddCredit} color="primary" disabled={!canManageCredits}><AddCardIcon /></IconButton></Tooltip>
          <Tooltip title={t('edit')}><IconButton onClick={onEdit} disabled={!canManageCredits}><EditIcon /></IconButton></Tooltip>
          <Tooltip title={t('delete')}><IconButton onClick={onDelete} color="error" disabled={!canManageCredits}><DeleteIcon /></IconButton></Tooltip>
        </Box>
      </Paper>
    </Grid>
  );
}

export default function Clients() {
  const { state, dispatch, addClient, updateClient, deleteClient, addCredit } = useApp();
  const { t } = useLocale();
  const { username, hasPermission } = useAuth();
  const { notify } = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rawPhone, setRawPhone] = useState('');
  const [editClient, setEditClient] = useState(null);
  
  const formatPhone = (digits) => {
    let formatted = '+998 ';
    if (digits.length >= 2) formatted += `(${digits.slice(0, 2)}) `;
    else if (digits.length === 1) formatted += `(${digits.slice(0, 1)}`;
    if (digits.length >= 5) formatted += `${digits.slice(2, 5)} `;
    else if (digits.length >= 3) formatted += `${digits.slice(2, digits.length)}`;
    if (digits.length >= 7) formatted += `${digits.slice(5, 7)} `;
    else if (digits.length >= 6) formatted += `${digits.slice(5, 6)}`;
    if (digits.length >= 9) formatted += `${digits.slice(7, 9)}`;
    else if (digits.length >= 8) formatted += `${digits.slice(7, 8)}`;
    return formatted.trim();
  };
  
  const parsePhone = (formatted) => {
    const digits = formatted.replace(/\D/g, '');
    return digits.slice(3); // remove +998
  };
  
  const handlePhoneChange = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    setRawPhone(digits);
    setPhone(formatPhone(digits));
  };
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [search, setSearch] = useState('');
  
  // State for credit dialogs (kept as is)
  const [creditOpen, setCreditOpen] = useState(false);
  const [viewCreditsOpen, setViewCreditsOpen] = useState(false);
  const [creditClient, setCreditClient] = useState(null);
  const [viewClient, setViewClient] = useState(null);
  const [creditType, setCreditType] = useState('pul'); // 'pul' or 'mahsulot'
  const [creditSubtype, setCreditSubtype] = useState('berilgan'); // 'olingan' or 'berilgan'
  const [creditAmount, setCreditAmount] = useState('');
  const [creditCurrency, setCreditCurrency] = useState('UZS');
  const [products, setProducts] = useState([]);
  const [location, setLocation] = useState('warehouse');
  const [creditDate, setCreditDate] = useState(new Date().toISOString().slice(0,10));
  const [creditNote, setCreditNote] = useState('');
  const [initialPayment, setInitialPayment] = useState('');


  const handleSave = () => {
    if (!(hasPermission && hasPermission('credits_manage'))) { notify('Error', t('permissionDenied') || 'Permission denied', 'error'); return; }
    if (!name.trim()) return;
    if (rawPhone.length !== 9) { notify('Warning', 'Telefon raqami 9 ta raqam bo\'lishi kerak', 'warning'); return; }
    const formattedPhone = formatPhone(rawPhone);
    const payload = { id: uuidv4(), name: name.trim(), phone: formattedPhone, owner: username };
    addClient(payload, { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'CLIENT_ADD', kind: 'CLIENT_ADD', product_name: payload.name, qty: 1, unit_price: 0, amount: 0, currency: 'UZS', detail: `Added client ${payload.name}` });
    setOpen(false);
  };

  const handleEditSave = () => {
      const handleEditSave = () => {
    if (!(hasPermission && hasPermission('credits_manage'))) { notify('Error', t('permissionDenied') || 'Permission denied', 'error'); return; }
    if (!editClient || !name.trim()) return;
    if (rawPhone.length !== 9) { notify('Warning', 'Telefon raqami 9 ta raqam bo\'lishi kerak', 'warning'); return; }
    const formattedPhone = formatPhone(rawPhone);
    updateClient(editClient.id, { name: name.trim(), phone: formattedPhone }, { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'CLIENT_EDIT', kind: 'CLIENT_EDIT', product_name: name.trim(), qty: 1, unit_price: 0, amount: 0, currency: 'UZS', detail: `Edited client ${name.trim()}` });
    setEditClient(null);
  };
  
  const handleDelete = (id) => {
    const client = state.clients.find(c => c.id === id);
    deleteClient(id, { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'CLIENT_DELETE', kind: 'CLIENT_DELETE', product_name: client?.name || id, qty: 1, unit_price: 0, amount: 0, currency: 'UZS', detail: `Deleted client ${client?.name || id}` });
    setConfirm({ open: false, id: null });
  };

  const addProduct = () => setProducts([...products, { name: '', qty: '', receivePrice: '', receiveCurrency: 'UZS', sellPrice: '', sellCurrency: 'UZS' }]);
  const updateProduct = (index, field, value) => setProducts(products.map((p, i) => i === index ? { ...p, [field]: value } : p));
  const removeProduct = (index) => setProducts(products.filter((_, i) => i !== index));

  const handleAddCredit = async () => {
    let amount, currency;
    let detail = '';
    const initialPayAmount = Number(initialPayment) || 0;

    if (creditType === 'pul') {
      if (!creditAmount) return;
      const totalAmount = Number(creditAmount);
      if (initialPayAmount > totalAmount) {
        notify('Warning', "Boshlang'ich to'lov umumiy miqdordan ko'p bo'lishi mumkin emas", 'warning'); return;
      }
      amount = totalAmount;
      currency = creditCurrency;
      detail = `Added money credit for ${creditClient.name}: ${totalAmount} ${currency}`;
      if (initialPayAmount > 0) {
        detail += `, with an initial payment of ${initialPayAmount} ${currency}`;
      }
    } else {
      if (products.length === 0 || products.some(p => !p.name || !p.qty || (creditSubtype === 'olingan' ? !p.receivePrice : !p.sellPrice))) return;
      amount = products.reduce((sum, p) => sum + Number(p.qty) * Number(creditSubtype === 'olingan' ? p.receivePrice : p.sellPrice), 0);
      currency = products[0][creditSubtype === 'olingan' ? 'receiveCurrency' : 'sellCurrency'];
      if (initialPayAmount > amount) {
        notify('Warning', "Boshlang'ich to'lov umumiy miqdordan ko'p bo'lishi mumkin emas", 'warning'); return;
      }
      const productDetails = products.map(p => `${p.qty} x ${p.name}`).join(', ');
      detail = `Added product credit for ${creditClient.name}: ${productDetails}`;
      if (initialPayAmount > 0) {
        detail += `, with an initial payment of ${initialPayAmount} ${currency}`;
      }
    }

    const logPayload = {
        id: uuidv4(),
        user_name: username,
        action: 'CREDIT_ADD',
        kind: creditType === 'pul' ? 'CREDIT_ADD_MONEY' : 'CREDIT_ADD_PRODUCT',
        product_name: creditClient.name,
        detail: detail,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString(),
        amount: amount,
        currency: currency,
    };
    // insertLog(logPayload); // Removed: addCredit action already handles logging

    // Use AppContext action which enforces permissions
    try {
      await addCredit(payload, { id: uuidv4(), user: username, action: 'CREDIT_ADD', detail: `Added credit for ${creditClient.name}` });
    } catch (e) {
      console.error('addCredit failed', e);
      // window.alert(t('permissionDenied') || 'Permission denied'); // Removed as AppContext's addCredit handles this
      return;
    }
    
    if (initialPayAmount > 0) {
      const paymentLog = {
          id: uuidv4(),
          user_name: username,
          action: 'CREDIT_PAYMENT',
          kind: 'PAYMENT',
          product_name: `Payment for credit to ${creditClient.name}`,
          detail: `Initial payment of ${initialPayAmount} ${currency} for credit to ${creditClient.name}`,
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString(),
          amount: initialPayAmount,
          currency: currency,
      };
      await insertLog(paymentLog); // Await this as it's an async operation
    }

    if (creditType === 'mahsulot') {
      for (const p of products) { // Use for...of for async operations in loop
        if (creditSubtype === 'olingan') {
          // Add to inventory using useApp action creator
          const productPayload = {
            id: uuidv4(),
            name: p.name,
            qty: Number(p.qty),
            price: Number(p.receivePrice),
            cost: Number(p.sellPrice),
            currency: p.receiveCurrency
          };
          const logData = { id: uuidv4(), user_name: username, action: 'WAREHOUSE_ADD', detail: `Added ${p.qty} ${p.name} from client ${creditClient.name}` };
          if (location === 'warehouse') {
            await addWarehouseProduct(productPayload, logData);
          } else {
            await addStoreProduct(productPayload, logData);
          }
        } else {
          // Subtract from inventory using useApp action creator
          const inventory = location === 'warehouse' ? state.warehouse : state.store;
          const existing = inventory.find(item => item.name === p.name);
          if (existing) {
            const newQty = Number(existing.qty) - Number(p.qty);
            if (newQty < 0) {
              notify('Warning', `Not enough ${p.name} in ${location}. Available: ${existing.qty}, trying to sell: ${p.qty}`, 'warning');
              continue; // Skip this product or handle error more robustly
            }
            const logData = { id: uuidv4(), user_name: username, action: 'INVENTORY_SELL', detail: `Sold ${p.qty} ${p.name} to client ${creditClient.name}` };
            if (location === 'warehouse') {
              await updateWarehouseProduct(existing.id, { qty: newQty }, logData);
            } else {
              await updateStoreProduct(existing.id, { qty: newQty }, logData);
            }
          } else {
            notify('Error', `Product ${p.name} not found in ${location}.`, 'error');
          }
        }
      }
    }
    setCreditOpen(false);
    setCreditClient(null);
  };

  const filteredClients = state.clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('clients')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setOpen(true); setName(''); setRawPhone(''); setPhone('+998 '); }} disabled={!(hasPermission && hasPermission('credits_manage'))}>{t('addClient')}</Button>
      </Box>
      <Paper sx={{ p: 2 }}>
        <TextField
          fullWidth
          placeholder={t('search_clients') || 'Search clients...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Grid container spacing={3}>
          {filteredClients.map(c => (
            <ClientCard 
              key={c.id}
              client={c}
              canManageCredits={hasPermission && hasPermission('credits_manage')}
              onEdit={() => { setEditClient(c); setName(c.name); const digits = parsePhone(c.phone); setRawPhone(digits); setPhone(formatPhone(digits)); }}
              onDelete={() => setConfirm({ open: true, id: c.id })}
              onAddCredit={() => { 
                setCreditClient(c); 
                setCreditType('pul');
                setCreditSubtype('berilgan');
                setCreditAmount('');
                setInitialPayment('');
                setCreditCurrency('UZS'); 
                setProducts([]);
                setLocation('warehouse');
                setCreditDate(new Date().toISOString().slice(0,10)); 
                setCreditNote(''); 
                setCreditOpen(true); 
              }}
              onViewCredits={() => { setViewClient(c); setViewCreditsOpen(true); }}
            />
          ))}
        </Grid>
      </Paper>
      
      {/* Add/Edit Client Dialog */}
      <Dialog open={open || !!editClient} onClose={() => { setOpen(false); setEditClient(null); }}>
        <DialogTitle>{editClient ? t('editClient') : t('addClient')}</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label={t('clientNameLabel')} type="text" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            margin="dense"
            label={t('clientPhoneLabel')}
            type="text"
            fullWidth
            value={phone} // Display the formatted phone
            onChange={(e) => handlePhoneChange(e.target.value)} // Use the dedicated handler
            InputLabelProps={{ shrink: true }} // Keep label from overlapping
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpen(false); setEditClient(null); }}>{t('cancel')}</Button>
          <Button onClick={editClient ? handleEditSave : handleSave}>{t('save')}</Button>
        </DialogActions>
      </Dialog>
      
      <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open: false, id: null })} title={t('confirm_delete_client')} onConfirm={() => handleDelete(confirm.id)}>
        {t('confirm_delete_body')}
      </ConfirmDialog>
      
      {/* Placeholder for complex credit dialogs */}
      <CreditsDialog open={viewCreditsOpen} onClose={() => setViewCreditsOpen(false)} clientId={viewClient?.id} clientName={viewClient?.name} />
      
      {/* Add Credit Dialog */}
      <Dialog open={creditOpen} onClose={() => setCreditOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>{t('addCredit')} - {creditClient?.name}</DialogTitle>
        <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <TextField
            select
            label="Turi"
            fullWidth
            margin="dense"
            value={creditType}
            onChange={(e) => setCreditType(e.target.value)}
          >
            <MenuItem value="pul">Pul</MenuItem>
            <MenuItem value="mahsulot">Mahsulot</MenuItem>
          </TextField>
          <TextField
            select
            label="Olish/Berish"
            fullWidth
            margin="dense"
            value={creditSubtype}
            onChange={(e) => setCreditSubtype(e.target.value)}
          >
            <MenuItem value="olingan">Olingan</MenuItem>
            <MenuItem value="berilgan">Berilgan</MenuItem>
          </TextField>
          {creditType === 'pul' ? (
            <>
              <TextField
                label="Miqdor"
                type="number"
                fullWidth
                margin="dense"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
              <TextField
                label="Boshlang'ich to'lov"
                type="number"
                fullWidth
                margin="dense"
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
              />
              <TextField
                select
                label="Valyuta"
                fullWidth
                margin="dense"
                value={creditCurrency}
                onChange={(e) => setCreditCurrency(e.target.value)}
              >
                <MenuItem value="UZS">UZS</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
              </TextField>
            </>
          ) : (
            <>
              <TextField
                select
                label="Joylashuv"
                fullWidth
                margin="dense"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <MenuItem value="warehouse">Ombor</MenuItem>
                <MenuItem value="store">Do'kon</MenuItem>
              </TextField>
              <Typography variant="subtitle1" sx={{ mt: 2 }}>Mahsulotlar</Typography>
              {products.map((p, index) => (
                <Grid container spacing={1} key={index} sx={{ mb: 2, alignItems: 'center' }}>
                  <Grid item xs={12} sm={4}>
                    {creditSubtype === 'berilgan' ? (
                      <TextField
                        select
                        label="Mahsulot"
                        fullWidth
                        margin="dense"
                        value={p.name}
                        onChange={(e) => updateProduct(index, 'name', e.target.value)}
                      >
                        {(location === 'warehouse' ? state.warehouse : state.store).map(item => (
                          <MenuItem key={item.id} value={item.name}>{item.name} (Mavjud: {item.qty})</MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <TextField
                        label="Mahsulot nomi"
                        fullWidth
                        margin="dense"
                        value={p.name}
                        onChange={(e) => updateProduct(index, 'name', e.target.value)}
                      />
                    )}
                  </Grid>
                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="Soni"
                      type="number"
                      fullWidth
                      margin="dense"
                      value={p.qty}
                      onChange={(e) => updateProduct(index, 'qty', e.target.value)}
                    />
                  </Grid>
                  {creditSubtype === 'olingan' && (
                    <>
                      <Grid item xs={6} sm={2}>
                        <TextField
                          label="Olish narxi"
                          type="number"
                          fullWidth
                          margin="dense"
                          value={p.receivePrice}
                          onChange={(e) => updateProduct(index, 'receivePrice', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={6} sm={1}>
                        <TextField
                          select
                          label="Val"
                          fullWidth
                          margin="dense"
                          value={p.receiveCurrency}
                          onChange={(e) => updateProduct(index, 'receiveCurrency', e.target.value)}
                        >
                          <MenuItem value="UZS">UZS</MenuItem>
                          <MenuItem value="USD">USD</MenuItem>
                        </TextField>
                      </Grid>
                    </>
                  )}
                  <Grid item xs={6} sm={2}>
                    <TextField
                      label="Sotish narxi"
                      type="number"
                      fullWidth
                      margin="dense"
                      value={p.sellPrice}
                      onChange={(e) => updateProduct(index, 'sellPrice', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} sm={1}>
                    <TextField
                      select
                      label="Val"
                      fullWidth
                      margin="dense"
                      value={p.sellCurrency}
                      onChange={(e) => updateProduct(index, 'sellCurrency', e.target.value)}
                    >
                      <MenuItem value="UZS">UZS</MenuItem>
                      <MenuItem value="USD">USD</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <IconButton onClick={() => removeProduct(index)} color="error" sx={{ mt: 1 }}>
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
              <Button onClick={addProduct} variant="outlined" sx={{ mt: 1 }}>Mahsulot qo'shish</Button>
              <TextField
                label="Boshlang'ich to'lov"
                type="number"
                fullWidth
                margin="dense"
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
              />
            </>
          )}
          <TextField
            label="Sana"
            type="date"
            fullWidth
            margin="dense"
            value={creditDate}
            onChange={(e) => setCreditDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Izoh"
            fullWidth
            margin="dense"
            value={creditNote}
            onChange={(e) => setCreditNote(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreditOpen(false)}>Bekor</Button>
          <Button onClick={handleAddCredit} variant="contained" disabled={creditType === 'pul' ? !creditAmount : products.length === 0 || products.some(p => !p.name || !p.qty || (creditSubtype === 'olingan' ? !p.receivePrice : !p.sellPrice))}>Qoshish</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}