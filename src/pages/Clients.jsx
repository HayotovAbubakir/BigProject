import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box, Typography, Button, Grid, Paper, IconButton, Tooltip, TextField,
  Dialog, DialogActions, DialogContent, DialogTitle, Avatar, List, ListItem, ListItemText, useMediaQuery, useTheme, Select, MenuItem, Checkbox, CircularProgress
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
import { supabase } from '/supabase/supabaseClient';
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
          <Tooltip title={t('addCredit')}><IconButton onClick={onAddCredit} color="primary"><AddCardIcon /></IconButton></Tooltip>
          <Tooltip title={t('edit')}><IconButton onClick={onEdit}><EditIcon /></IconButton></Tooltip>
          <Tooltip title={t('delete')}><IconButton onClick={onDelete} color="error"><DeleteIcon /></IconButton></Tooltip>
        </Box>
      </Paper>
    </Grid>
  );
}

export default function Clients() {
  const { state, addClient, updateClient, deleteClient, addCredit, addWarehouseProduct, addStoreProduct } = useApp();
  const { t } = useLocale();
  const { username, hasPermission } = useAuth();
  const { notify } = useNotification();
  
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
    const allDigits = value.replace(/\D/g, '');
    const localDigits = allDigits.startsWith('998') ? allDigits.substring(3) : allDigits;
    const digits = localDigits.slice(0, 9);
    setRawPhone(digits);
    setPhone(formatPhone(digits));
  };
  const [confirm, setConfirm] = useState({ open: false, id: null, password: '', verifying: false });
  const [search, setSearch] = useState('');
  
  // State for credit dialogs (kept as is)
  const [creditOpen, setCreditOpen] = useState(false);
  const [viewCreditsOpen, setViewCreditsOpen] = useState(false);
  const [creditClient, setCreditClient] = useState(null);
  const [viewClient, setViewClient] = useState(null);
  const [creditType, setCreditType] = useState('cash'); // 'cash' or 'product'
  const [creditSubtype, setCreditSubtype] = useState('berilgan'); // 'olingan' or 'berilgan'
  const [creditAmount, setCreditAmount] = useState('');
  const [creditCurrency, setCreditCurrency] = useState('UZS');
  const [products, setProducts] = useState([]);
  const [location, setLocation] = useState('warehouse');
  const [creditDate, setCreditDate] = useState(new Date().toISOString().slice(0,10));
  const [creditNote, setCreditNote] = useState('');
  const [initialPayment, setInitialPayment] = useState('');


  const handleSave = () => {
    if (!name.trim()) return;
    if (rawPhone.length !== 9) { notify('Warning', 'Telefon raqami 9 ta raqam bo\'lishi kerak', 'warning'); return; }
    const formattedPhone = formatPhone(rawPhone);
    const payload = { id: uuidv4(), name: name.trim(), phone: formattedPhone };
    addClient(payload, { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'CLIENT_ADD', kind: 'CLIENT_ADD', product_name: payload.name, qty: 1, unit_price: 0, amount: 0, currency: 'UZS', detail: `Added client ${payload.name}` });
    setOpen(false);
  };

  const handleEditSave = () => {
    if (!editClient || !name.trim()) return;
    if (rawPhone.length !== 9) { notify('Warning', 'Telefon raqami 9 ta raqam bo\'lishi kerak', 'warning'); return; }
    const formattedPhone = formatPhone(rawPhone);
    updateClient(editClient.id, { name: name.trim(), phone: formattedPhone }, { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'CLIENT_EDIT', kind: 'CLIENT_EDIT', product_name: name.trim(), qty: 1, unit_price: 0, amount: 0, currency: 'UZS', detail: `Edited client ${name.trim()}` });
    setEditClient(null);
  };
  
  const handleDeleteClick = (id) => {
    setConfirm({ open: true, id, password: '', verifying: false });
  };

  const handlePasswordConfirm = async () => {
    if (!confirm.password) {
      notify('Xato', 'Parol kiritish kerak', 'error');
      return;
    }

    setConfirm(s => ({ ...s, verifying: true }));

    try {
      // Parolni tekshirish
      const { data, error } = await supabase
        .from('user_credentials')
        .select('password_hash')
        .eq('username', username)
        .maybeSingle();

      if (error || !data) {
        notify('Xato', 'Foydalanuvchi topilmadi', 'error');
        setConfirm(s => ({ ...s, verifying: false }));
        return;
      }

      // Parol tekshirish
      if (data.password_hash !== confirm.password) {
        notify('Xato', 'Parol noto\'g\'ri! Klient o\'chirilmadi.', 'error');
        setConfirm(s => ({ ...s, verifying: false, password: '' }));
        return;
      }

      // Parol to'g'ri - klientni o'chir
      const client = state.clients.find(c => c.id === confirm.id);
      deleteClient(confirm.id, { id: uuidv4(), date: new Date().toISOString().slice(0, 10), time: new Date().toLocaleTimeString(), user_name: username, action: 'CLIENT_DELETE', kind: 'CLIENT_DELETE', product_name: client?.name || confirm.id, qty: 1, unit_price: 0, amount: 0, currency: 'UZS', detail: `Deleted client ${client?.name || confirm.id}` });
      notify('Muvaffaqiyat', 'Klient o\'chirildi', 'success');
      setConfirm({ open: false, id: null, password: '', verifying: false });
    } catch (err) {
      console.error('Delete error:', err);
      notify('Xato', 'Klientni o\'chirishda xatolik yuz berdi', 'error');
      setConfirm(s => ({ ...s, verifying: false }));
    }
  };

  const addProduct = () => setProducts([...products, { name: '', qty: '', receivePrice: '', receiveCurrency: 'UZS', sellPrice: '', sellCurrency: 'UZS', isNewProduct: false }]);
  const updateProduct = (index, field, value) => setProducts(products.map((p, i) => i === index ? { ...p, [field]: value } : p));
  const removeProduct = (index) => setProducts(products.filter((_, i) => i !== index));

  const handleAddCredit = async () => {
    const initialPayAmount = Number(initialPayment) || 0;

    if (creditType === 'cash') {
      if (!creditAmount) return;
      const totalAmount = Number(creditAmount);
      if (initialPayAmount > totalAmount) {
        notify('Warning', "Boshlang'ich to'lov umumiy miqdordan ko'p bo'lishi mumkin emas", 'warning'); return;
      }
      const payload = {
        id: uuidv4(),
        client_id: creditClient.id,
        name: creditClient.name,
        credit_type: 'cash',
        amount: totalAmount,
        currency: creditCurrency,
        bosh_toluv: initialPayAmount,
        completed: (totalAmount - initialPayAmount) <= 0,
        created_by: username,
        date: creditDate,
        note: creditNote,
      };
        const logData = {
          id: uuidv4(),
          date: payload.date || new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString(),
          user_name: username,
          action: 'CREDIT_ADD',
          kind: 'CREDIT_ADD',
          product_name: null,
          qty: 1,
          unit_price: payload.amount,
          amount: payload.amount,
          currency: payload.currency || 'UZS',
          client_name: payload.name,
          down_payment: payload.bosh_toluv,
          remaining: (payload.amount || 0) - (payload.bosh_toluv || 0),
          credit_type: payload.credit_type || payload.type || 'cash',
          detail: `Added cash credit for ${creditClient.name}: amount ${payload.amount} ${payload.currency || 'UZS'}`
        };
        await addCredit(payload, logData);

    } else { // product
      if (products.length === 0 || products.some(p => !p.name || !p.qty || !p.sellPrice)) return;

      for (const p of products) {
        let productId;
        let productName = p.name;
        let productQty = Number(p.qty);
        let productUnitPrice = Number(p.sellPrice);
        let productCurrency = p.sellCurrency;

        if (p.isNewProduct) {
          if (creditSubtype === 'olingan') {
            // New product being received as credit
            const newProductId = uuidv4();
            const productPayload = {
              id: newProductId,
              name: productName,
              qty: productQty,
              price: Number(p.receivePrice),
              currency: p.receiveCurrency
            };
            const logData = { id: uuidv4(), user_name: username, action: 'PRODUCT_ADD', detail: `Added new product ${productName} via credit from client ${creditClient.name}` };
            if (location === 'warehouse') {
              await addWarehouseProduct(productPayload, logData);
            } else {
              await addStoreProduct(productPayload, logData);
            }
            productId = newProductId;
          } else {
            notify('Error', 'Yangi mahsulotni faqat qabul qilingan nasiya sifatida kiritish mumkin.', 'error');
            return;
          }
        } else {
          // Existing product
          const inventory = location === 'warehouse' ? state.warehouse : state.store;
          const existingProduct = inventory.find(item => item.name === p.name);
          if (!existingProduct) {
            notify('Error', `Mahsulot "${p.name}" ${location === 'warehouse' ? 'omborda' : 'do\'konda'} topilmadi.`, 'error');
            return;
          }
          productId = existingProduct.id;
        }

        const payload = {
          id: uuidv4(),
          client_id: creditClient.id,
          name: creditClient.name,
          credit_type: 'product',
          product_id: productId,
          qty: productQty,
          unit_price: productUnitPrice,
          currency: productCurrency,
          bosh_toluv: 0,
          completed: false,
          created_by: username,
          date: creditDate,
          note: creditNote,
        };
        const logData = {
          id: uuidv4(),
          date: payload.date || new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString(),
          user_name: username,
          action: 'CREDIT_ADD',
          kind: 'CREDIT_ADD',
          product_name: productName,
          qty: productQty,
          unit_price: productUnitPrice,
          amount: (productQty || 0) * (productUnitPrice || 0),
          currency: productCurrency || 'UZS',
          product_id: productId,
          client_name: creditClient.name,
          down_payment: 0,
          remaining: (productQty || 0) * (productUnitPrice || 0),
          credit_type: 'product',
          detail: `Added product credit for ${creditClient.name}: ${productQty} x ${productName} @ ${productUnitPrice} ${productCurrency || 'UZS'}`
        };
        await addCredit(payload, logData);
      }
    }

    if (initialPayAmount > 0 && creditType === 'product') {
      const paymentLog = {
          id: uuidv4(),
          user_name: username,
          action: 'CREDIT_PAYMENT',
          kind: 'PAYMENT',
          product_name: `Payment for credit to ${creditClient.name}`,
          detail: `Initial payment of ${initialPayAmount} ${creditCurrency} for credit to ${creditClient.name}`,
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString(),
          amount: initialPayAmount,
          currency: creditCurrency,
      };
      await insertLog(paymentLog);
    }

    setCreditOpen(false);
    setCreditClient(null);
  };

  const filteredClients = state.clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('clients')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setOpen(true); setName(''); setRawPhone(''); setPhone('+998 '); }}>{t('addClient')}</Button>
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
              onDelete={() => handleDeleteClick(c.id)}
              onAddCredit={() => { 
                setCreditClient(c); 
                setCreditType('cash');
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
      
      <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open: false, id: null, password: '', verifying: false })} title={t('confirm_delete_client')} onConfirm={() => handlePasswordConfirm()}>
        {t('confirm_delete_body')}
      </ConfirmDialog>
      
      {/* Password Confirmation Dialog for Client Deletion */}
      <Dialog open={confirm.open} onClose={() => setConfirm({ open: false, id: null, password: '', verifying: false })} fullWidth maxWidth="sm">
        <DialogTitle>Klientni o'chirish uchun parol tasdiqlang</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Klientni o'chirish uchun joriy akkauntning parolini kiriting:</Typography>
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="Parol"
            value={confirm.password}
            onChange={(e) => setConfirm(s => ({ ...s, password: e.target.value }))}
            disabled={confirm.verifying}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm({ open: false, id: null, password: '', verifying: false })} disabled={confirm.verifying}>
            Bekor
          </Button>
          <Button 
            onClick={handlePasswordConfirm} 
            color="error" 
            variant="contained" 
            disabled={confirm.verifying || !confirm.password}
          >
            {confirm.verifying ? <CircularProgress size={24} /> : "O'chirish"}
          </Button>
        </DialogActions>
      </Dialog>
      
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
            <MenuItem value="cash">Pul</MenuItem>
            <MenuItem value="product">Mahsulot</MenuItem>
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
          {creditType === 'cash' ? (
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {p.isNewProduct ? (
                        <TextField
                          label="Mahsulot nomi"
                          fullWidth
                          margin="dense"
                          value={p.name}
                          onChange={(e) => updateProduct(index, 'name', e.target.value)}
                        />
                      ) : (
                        <TextField
                          select
                          label="Mahsulotni tanlang"
                          fullWidth
                          margin="dense"
                          value={p.name}
                          onChange={(e) => updateProduct(index, 'name', e.target.value)}
                        >
                          <MenuItem value="">-- Mahsulotni tanlang --</MenuItem>
                          {(location === 'warehouse' ? state.warehouse : state.store).map(item => (
                            <MenuItem key={item.id} value={item.name}>{item.name} (Mavjud: {item.qty})</MenuItem>
                          ))}
                        </TextField>
                      )}
                      <Checkbox
                        checked={p.isNewProduct || false}
                        onChange={(e) => updateProduct(index, 'isNewProduct', e.target.checked)}
                        inputProps={{ 'aria-label': 'Yangi mahsulot' }}
                      />

                    </Box>
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
          <Button onClick={handleAddCredit} variant="contained" disabled={creditType === 'cash' ? !creditAmount : products.length === 0 || products.some(p => !p.name || !p.qty || (p.isNewProduct && creditSubtype === 'olingan' ? !p.receivePrice : !p.sellPrice))}>Qoshish</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}