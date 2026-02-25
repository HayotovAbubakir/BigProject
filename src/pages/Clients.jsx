import React, { useState, useMemo } from 'react';
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
import CurrencyField from '../components/CurrencyField';
import NumberField from '../components/NumberField';
import { insertLog } from '../firebase/supabaseLogs';
import { formatProductName } from '../utils/productDisplay';
import { DEFAULT_PRODUCT_CATEGORIES, mergeCategories, normalizeCategory, isMeterCategory } from '../utils/productCategories';
// Note: The credit management dialogs and logic are complex and are kept as is to avoid breaking functionality.
// Only the main client list UI is redesigned.

function ClientCard({ client, onAddCredit, onViewCredits, onEdit, onDelete, canManageCredits, isRestricted }) {
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
          <Tooltip title={t('addCredit')}><IconButton onClick={onAddCredit} color="primary" disabled={isRestricted}><AddCardIcon /></IconButton></Tooltip>
          <Tooltip title={t('edit')}><IconButton onClick={onEdit} disabled={isRestricted}><EditIcon /></IconButton></Tooltip>
          <Tooltip title={t('delete')}><IconButton onClick={onDelete} color="error" disabled={isRestricted}><DeleteIcon /></IconButton></Tooltip>
        </Box>
      </Paper>
    </Grid>
  );
}

export default function Clients() {
  const { state, addClient, updateClient, deleteClient, addCredit, addWarehouseProduct, addStoreProduct, updateWarehouseProduct, updateStoreProduct, updateCredit } = useApp();
  const { t } = useLocale();
  const { username, hasPermission, user, confirmPassword } = useAuth();
  const { notify } = useNotification();
  
  // Cheklangan userlar (new_account_restriction) qo'shish/tahrirlash/o'chirish/qarz qo'sha olmaydi
  const isRestricted = user?.permissions?.new_account_restriction ?? false;
  
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
  const categories = useMemo(() => mergeCategories(state.ui?.productCategories || [], DEFAULT_PRODUCT_CATEGORIES, (state.store||[]).map(p=>p.category), (state.warehouse||[]).map(p=>p.category)), [state.ui?.productCategories, state.store, state.warehouse]);
  const [location, setLocation] = useState('warehouse');
  const [creditDate, setCreditDate] = useState(new Date().toISOString().slice(0,10));
  const [creditNote, setCreditNote] = useState('');
  const [initialPayment, setInitialPayment] = useState('');
  const [initialPaymentCurrency, setInitialPaymentCurrency] = useState('UZS');


  const handleSave = () => {
    if (isRestricted) {
      notify('Xato', t('new_account_restriction_message') || 'Yangi qo\'shilgan akkauntlar bu amal\'ni bajarolmaslari mumkin', 'error');
      return;
    }
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
    if (isRestricted) {
      notify('Xato', t('new_account_restriction_message') || 'Yangi qo\'shilgan akkauntlar bu amal\'ni bajarolmaslari mumkin', 'error');
      return;
    }
    setConfirm({ open: true, id, password: '', verifying: false });
  };

  const handlePasswordConfirm = async () => {
    if (!confirm.password) {
      notify('Xato', 'Parol kiritish kerak', 'error');
      return;
    }

    setConfirm(s => ({ ...s, verifying: true }));

    try {
      const verify = await confirmPassword(confirm.password);
      if (!verify || !verify.ok) {
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

  const addProduct = () => setProducts([...products, { name: '', qty: '', receivePrice: '', receiveCurrency: 'UZS', sellPrice: '', sellCurrency: 'UZS', isNewProduct: false, category: '', pack_qty: '', electrode_size: '', stone_thickness: '', stone_size: '', price_piece: '', price_pack: '' }]);
  const updateProduct = (index, field, value) => setProducts(products.map((p, i) => i === index ? { ...p, [field]: value } : p));
  const removeProduct = (index) => setProducts(products.filter((_, i) => i !== index));

  const isProductFilled = (p) => {
    if (!p.name || !p.qty) return false;
    const cat = normalizeCategory(p.category || '');
    const isMeter = isMeterCategory(cat || p);
    const isBerilgan = creditSubtype === 'berilgan';
    const isBerilganMeter = isBerilgan && isMeter;

    // For meter items: pack size + both prices when received; only piece price when given.
    if (p.isNewProduct && isMeter) {
      const hasPack = Number(p.pack_qty) > 0;
      const piecePriceOk = Number(p.price_piece) > 0;
      if (isBerilgan) {
        return hasPack && piecePriceOk;
      }
      const meterPriceOk = Number(p.sellPrice) > 0;
      return hasPack && meterPriceOk && piecePriceOk;
    }

    if (p.isNewProduct && cat === 'elektrod') {
      // Electrodes: only pack price required; per-piece/per-meter ignored
      return !!p.electrode_size && Number(p.price_pack) > 0;
    }

    if (p.isNewProduct && isMeterCategory(cat)) {
      if (isBerilgan) {
        return Number(p.pack_qty) > 0 && Number(p.price_piece) > 0;
      }
      return Number(p.pack_qty) > 0 && Number(p.price_piece || p.sellPrice) > 0;
    }

    if (creditSubtype === 'olingan' && isMeter) {
      if (!p.receivePrice || Number(p.receivePrice) <= 0) return false;
    }

    if (isBerilganMeter) {
      return Number(p.price_piece) > 0;
    }

    return !!p.sellPrice;
  };

  const convertDownPayment = (amount, fromCurrency, toCurrency) => {
    const value = Number(amount || 0)
    const from = (fromCurrency || 'UZS').toUpperCase()
    const to = (toCurrency || 'UZS').toUpperCase()
    if (from === to) return value
    const rate = Number(state.exchangeRate || 0)
    if (!rate || rate <= 0) return null
    if (from === 'USD' && to === 'UZS') return Math.round(value * rate)
    if (from === 'UZS' && to === 'USD') return Number((value / rate).toFixed(2))
    return value
  }

  const resetCreditForm = () => {
    setCreditType('cash')
    setCreditSubtype('berilgan')
    setCreditAmount('')
    setCreditCurrency('UZS')
    setInitialPayment('')
    setInitialPaymentCurrency('UZS')
    setProducts([])
    setLocation('warehouse')
    setCreditDate(new Date().toISOString().slice(0,10))
    setCreditNote('')
  }

  const handleAddCredit = () => {
    if (!creditClient) return;

    // Snapshot current form values so we can reset UI immediately (optimistic UX)
    const snapshot = {
      creditType,
      creditSubtype,
      creditAmount,
      creditCurrency,
      initialPayment,
      initialPaymentCurrency,
      products: products.map(p => ({ ...p })),
      location,
      creditDate,
      creditNote,
      creditClient
    }

    // Close modal & clear fields without waiting for network
    setCreditOpen(false)
    resetCreditForm()
    setCreditClient(null)

    ;(async () => {
    const initialPayAmount = Number(snapshot.initialPayment) || 0;
    const initialPayCurrency = (snapshot.initialPaymentCurrency || snapshot.creditCurrency || 'UZS').toUpperCase();
    const convertedDownPaymentBase = convertDownPayment(initialPayAmount, initialPayCurrency, snapshot.creditCurrency);

    const {
      creditType,
      creditSubtype,
      creditAmount,
      creditCurrency,
      products,
      location,
      creditDate,
      creditNote,
      creditClient
    } = snapshot

    try {
    if (creditType === 'cash') {
      if (!creditAmount) return;
      const totalAmount = Number(creditAmount);
      const convertedDownPayment = convertedDownPaymentBase
      if (convertedDownPayment === null) {
        notify('Xato', 'Valyuta kursi kiritilmagan. Kursni kiriting yoki bir xil valyutada kiriting.', 'error')
        return
      }
      if (convertedDownPayment > totalAmount) {
        notify('Warning', "Boshlang'ich to'lov umumiy miqdordan ko'p bo'lishi mumkin emas", 'warning'); return;
      }
          const payload = {
            id: uuidv4(),
            client_id: creditClient.id,
            name: creditClient.name,
            credit_type: 'cash',
            credit_subtype: creditSubtype,
            amount: totalAmount,
            currency: creditCurrency,
            bosh_toluv: convertedDownPayment,
            bosh_toluv_original: initialPayAmount,
            bosh_toluv_currency: initialPayCurrency,
        completed: (totalAmount - convertedDownPayment) <= 0,
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
          kind: 'credit',
          product_name: null,
          qty: 1,
          unit_price: payload.amount,
          amount: payload.amount,
          currency: payload.currency || 'UZS',
          client_name: payload.name,
          down_payment: payload.bosh_toluv,
          remaining: (payload.amount || 0) - (payload.bosh_toluv || 0),
          credit_type: payload.credit_type || payload.type || 'cash',
          detail: `Added cash credit for ${creditClient.name}: amount ${payload.amount} ${payload.currency || 'UZS'}${initialPayAmount > 0 ? `, down payment ${payload.bosh_toluv} ${payload.currency || 'UZS'}${initialPayCurrency !== payload.currency ? ` (${initialPayAmount} ${initialPayCurrency})` : ''}` : ''}`
        };
        await addCredit(payload, logData);

    } else { // product
      if (products.length === 0 || products.some(p => !isProductFilled(p))) return;

      for (const p of products) {
        let productId;
        let productName = p.name;
        let productQty = Number(p.qty);
        let existingProduct = null;
        const cat = normalizeCategory(p.category || '');
        const isMeter = isMeterCategory(cat);
        const isElectrode = cat === 'elektrod';
        const packQty = isMeter ? Number(p.pack_qty || 0) : 0;

        if (p.isNewProduct) {
          // Allow new product for both 'olingan' (received) and 'berilgan' (given) credits
          const newProductId = uuidv4();
          const basePrice = isElectrode
            ? Number(p.price_pack || 0)
            : (creditSubtype === 'olingan'
                ? (isMeter ? Number(p.sellPrice || p.price_piece || 0) : Number(p.receivePrice || 0))
                : Number(p.sellPrice || p.price_piece || 0));
          const meterPrice = isMeter ? basePrice : null;
          const piecePrice = isElectrode
            ? null
            : (isMeter
                ? Number(p.price_piece || (meterPrice && packQty ? meterPrice * packQty : 0))
                : Number(p.price_piece || p.sellPrice || basePrice));
          const productPayload = {
            id: newProductId,
            name: productName,
            qty: productQty,
            price: isMeter ? meterPrice : basePrice,
            price_piece: piecePrice,
            price_pack: isElectrode ? Number(p.price_pack || 0) : null,
            pack_qty: isMeter ? packQty : null,
            meter_qty: isMeter ? Number(productQty * packQty) : null,
            category: cat,
            electrode_size: isElectrode ? (p.electrode_size || '') : null,
            stone_thickness: cat === 'tosh' ? (p.stone_thickness || '') : null,
            stone_size: cat === 'tosh' ? (p.stone_size || '') : null,
            currency: creditSubtype === 'olingan' ? (p.receiveCurrency || 'UZS') : (p.sellCurrency || 'UZS')
          };
          const logData = { id: uuidv4(), user_name: username, action: 'PRODUCT_ADD', detail: `Added new product ${productName} via credit (${creditSubtype}) for client ${creditClient.name}` };

          if (creditSubtype === 'olingan') {
            // receiving: create and add to inventory
            if (location === 'warehouse') {
              await addWarehouseProduct(productPayload, logData);
            } else {
              await addStoreProduct(productPayload, logData);
            }
            productId = newProductId;
            existingProduct = productPayload;
          } else {
            // berilgan: do NOT touch inventory; standalone product record for credit only
            productId = null;
            existingProduct = null;
          }
        } else {
          // Existing product
          const inventory = location === 'warehouse' ? state.warehouse : state.store;
          existingProduct = inventory.find(item => item.name === p.name);
          if (!existingProduct) {
            notify('Error', `Mahsulot "${p.name}" ${location === 'warehouse' ? 'omborda' : 'do\'konda'} topilmadi.`, 'error');
            return;
          }
          productId = existingProduct.id;
        }

        const derivedCategory = normalizeCategory(p.category || existingProduct?.category || '');
        const isMeterResolved = isMeterCategory(derivedCategory || existingProduct || p);
        const packQtyResolved = Number(p.pack_qty || existingProduct?.pack_qty || 0);
        const totalMeters = isMeterResolved ? Number(productQty * (packQtyResolved || 0)) : 0;
        let creditUnitPrice;
        if (creditSubtype === 'olingan') {
          creditUnitPrice = Number(isMeterResolved ? p.sellPrice || p.price_piece || p.price_pack : p.receivePrice || 0);
        } else {
          creditUnitPrice = Number(isMeterResolved ? (p.price_piece || p.sellPrice || 0) : (p.sellPrice || p.price_piece || p.price_pack));
        }
        const productCurrency = creditSubtype === 'olingan' ? (p.receiveCurrency || 'UZS') : (p.sellCurrency || 'UZS');
        const qtyForAmount = (creditSubtype === 'berilgan' && isMeterResolved)
          ? productQty
          : (isMeterResolved ? (totalMeters > 0 ? totalMeters : productQty) : productQty);
        const totalAmount = Number(qtyForAmount || 0) * Number(creditUnitPrice || 0);
        const convertedDownPayment = convertDownPayment(initialPayAmount, initialPayCurrency, productCurrency)
        if (convertedDownPayment === null) {
          notify('Xato', 'Valyuta kursi kiritilmagan. Kursni kiriting yoki bir xil valyutada kiriting.', 'error')
          return
        }

        // Inventory adjustments for existing products happen after calculations to avoid TDZ errors
        if (!p.isNewProduct && creditSubtype === 'berilgan') {
          const available = Number(existingProduct.qty || 0);
          if (available < productQty) {
            notify('Error', `Tanlangan mahsulotdan yetarli zaxira yo'q. Mavjud: ${available}`, 'error');
            return;
          }
          const newQty = Math.max(0, available - productQty);
          const invLog = {
            id: uuidv4(),
            date: new Date().toISOString().slice(0,10),
            time: new Date().toLocaleTimeString(),
            user_name: username,
            action: 'product_credited',
            kind: 'CREDIT',
            product_name: existingProduct.name,
            qty: productQty,
            unit_price: creditUnitPrice,
            amount: totalAmount,
            currency: productCurrency,
            detail: `Kim: ${username}, Sana: ${new Date().toLocaleDateString('uz-UZ')} ${new Date().toLocaleTimeString()}, Harakat: Nasiya sotildi (ombor/do'kondan chiqarildi), Klient: ${creditClient.name}, Mahsulot: ${existingProduct.name}, Soni: ${productQty}, Narx: ${creditUnitPrice} ${productCurrency}, Jami: ${totalAmount} ${productCurrency}`
          };
          if (location === 'warehouse') {
            await updateWarehouseProduct(existingProduct.id, { qty: newQty }, invLog);
          } else {
            await updateStoreProduct(existingProduct.id, { qty: newQty }, invLog);
          }
        }
        if (!p.isNewProduct && creditSubtype === 'olingan') {
          const available = Number(existingProduct.qty || 0);
          const newQty = available + productQty;
          const invLog = {
            id: uuidv4(),
            date: new Date().toISOString().slice(0,10),
            time: new Date().toLocaleTimeString(),
            user_name: username,
            action: 'product_received_credit',
            kind: 'CREDIT',
            product_name: existingProduct.name,
            qty: productQty,
            unit_price: creditUnitPrice,
            amount: totalAmount,
            currency: productCurrency,
            detail: `Kim: ${username}, Sana: ${new Date().toLocaleDateString('uz-UZ')} ${new Date().toLocaleTimeString()}, Harakat: Nasiya qabul qilindi (omborga qo'shildi), Klient: ${creditClient.name}, Mahsulot: ${existingProduct.name}, Soni: ${productQty}, Narx: ${creditUnitPrice} ${productCurrency}, Jami: ${totalAmount} ${productCurrency}`
          };
          if (location === 'warehouse') {
            await updateWarehouseProduct(existingProduct.id, { qty: newQty }, invLog);
          } else {
            await updateStoreProduct(existingProduct.id, { qty: newQty }, invLog);
          }
        }

          const payload = {
            id: uuidv4(),
            client_id: creditClient.id,
            name: creditClient.name,
            credit_type: 'product',
            credit_subtype: creditSubtype,
            product_id: productId,
            product_name: productName,
            qty: productQty,
            unit_price: creditUnitPrice,
            amount: totalAmount,
          bosh_toluv: convertedDownPayment,
          bosh_toluv_original: initialPayAmount,
          bosh_toluv_currency: initialPayCurrency,
          currency: productCurrency,
          // bosh_toluv set above from initial payment
          completed: totalAmount - convertedDownPayment <= 0,
          created_by: username,
          date: creditDate,
          note: creditNote,
        };
        
        // Create BOTH credit log AND sales log for daily_sales reporting
        const creditLogData = {
          id: uuidv4(),
          date: payload.date || new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString(),
          user_name: username,
          action: 'CREDIT_ADD',
          kind: 'credit',
          product_name: productName,
          qty: productQty,
          unit_price: creditUnitPrice,
          amount: totalAmount,
          currency: productCurrency || 'UZS',
          product_id: productId,
          client_name: creditClient.name,
          down_payment: convertedDownPayment || 0,
          remaining: totalAmount,
          credit_type: 'product',
          detail: `Kim: ${username}, Sana: ${new Date().toLocaleDateString('uz-UZ')} ${new Date().toLocaleTimeString()}, Harakat: Nasiya qo'shildi (${creditSubtype}), Klient: ${creditClient.name}, Mahsulot: ${productName}, Kategoriya: ${derivedCategory || '-'}, ${isElectrode ? `Razmer: ${p.electrode_size || existingProduct?.electrode_size || '-'}, ` : ''}${derivedCategory === 'tosh' ? `Qalinlik: ${p.stone_thickness || existingProduct?.stone_thickness || '-'}, Hajmi: ${p.stone_size || existingProduct?.stone_size || '-'}, ` : ''}${isMeter ? `Pachka: ${packQtyResolved || 0}, Metr: ${totalMeters || 0}, ` : ''}Soni: ${productQty}, Narx: ${creditUnitPrice} ${productCurrency}, Jami: ${totalAmount} ${productCurrency}, Bosh to'lov: ${convertedDownPayment} ${productCurrency}${initialPayCurrency !== productCurrency ? ` (${initialPayAmount} ${initialPayCurrency})` : ''}`
        };
        
        // ALSO create a SELL log for daily_sales so it appears in dashboard daily sales
        const salesLogData = {
          id: uuidv4(),
          date: payload.date || new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString(),
          user_name: username,
          action: 'CREDIT_SALE',
          kind: 'SELL',
          product_name: productName,
          qty: productQty,
          unit_price: creditUnitPrice,
          amount: totalAmount,
          currency: productCurrency || 'UZS',
          product_id: productId,
          client_name: creditClient.name,
          total_uzs: productCurrency === 'USD' ? Math.round(totalAmount * (state.exchangeRate || 1)) : totalAmount,
          detail: `Nasiya sotuvı (berildi) ${creditClient.name} ga: ${productQty} x ${productName} @ ${creditUnitPrice} ${productCurrency || 'UZS'}`
        };
        
        const created = await addCredit(payload, creditLogData);
        
        // Add sales log to daily_sales
        try {
          await insertLog(salesLogData);
        } catch (e) {
          console.warn('Failed to insert sales log for credit sale', e);
        }
        
        // If initial payment provided, we already included bosh_toluv in payload. If additional processing needed, update credit record.
        if (initialPayAmount > 0 && created && created.id) {
          try {
            const amountVal = Number(payload.amount || 0)
            const completedFlag = (amountVal - Number(convertedDownPayment || 0)) <= 0
            const updates = { bosh_toluv: Number(convertedDownPayment || 0), bosh_toluv_original: initialPayAmount, bosh_toluv_currency: initialPayCurrency, completed: completedFlag }
            const remainingAfter = Math.max(0, amountVal - Number(convertedDownPayment || 0))
            const creditLog = {
              id: uuidv4(),
              date: new Date().toISOString().slice(0,10),
              time: new Date().toLocaleTimeString(),
              user_name: username,
              action: 'CREDIT_PAYMENT',
              kind: 'PAYMENT',
              product_name: `Payment for credit to ${creditClient.name}`,
              amount: Number(convertedDownPayment || 0),
              currency: productCurrency,
              detail: [
                `Harakat: Boshlang'ich to'lov`,
                `Klient: ${creditClient.name}`,
                `Kredit turi: ${creditSubtype}`,
                `Kredit sanasi: ${payload.date || new Date().toISOString().slice(0,10)}`,
                `Asl summa: ${amountVal} ${productCurrency}`,
                `To'lov: ${initialPayAmount} ${initialPayCurrency} (=${Number(convertedDownPayment || 0)} ${productCurrency})`,
                `Qolgan: ${remainingAfter} ${productCurrency}`,
                `Foydalanuvchi: ${username}`,
                `Yaratilgan: ${new Date().toLocaleString('uz-UZ')}`
              ].join(', ')
            }
            await updateCredit(created.id, updates, creditLog)
          } catch (e) {
            console.warn('Failed to apply initial payment to created product credit', e)
          }
        }
      }
    }

    if (initialPayAmount > 0 && creditType === 'product') {
      const downPaymentForCredit = convertedDownPaymentBase;
      if (downPaymentForCredit === null) {
        notify('Xato', 'Valyuta kursi kiritilmagan. Kursni kiriting yoki bir xil valyutada kiriting.', 'error')
        return
      }
      const remainingAfter = Math.max(0, Number(creditAmount || 0) - Number(downPaymentForCredit || 0));
      const paymentLog = {
          id: uuidv4(),
          user_name: username,
          action: 'CREDIT_PAYMENT',
          kind: 'PAYMENT',
          product_name: `Payment for credit to ${creditClient.name}`,
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString(),
          amount: initialPayAmount,
          currency: initialPayCurrency,
          detail: [
            `Harakat: Boshlang'ich to'lov`,
            `Klient: ${creditClient.name}`,
            `Kredit turi: ${creditSubtype}`,
            `Kredit sanasi: ${creditDate}`,
            `Asl summa: ${creditAmount} ${creditCurrency}`,
            `To'lov: ${initialPayAmount} ${initialPayCurrency} (=${Number(downPaymentForCredit || 0)} ${creditCurrency})`,
            `Qolgan: ${remainingAfter} ${creditCurrency}`,
            `Foydalanuvchi: ${username}`,
            `Yaratilgan: ${new Date().toLocaleString('uz-UZ')}`
          ].join(', ')
      };
      await insertLog(paymentLog);
    }

    notify('Muvaffaqiyat', t('credit_saved') || "Nasiya qo'shildi", 'success');
    } catch (err) {
      console.error('Add credit failed:', err);
      notify('Xato', 'Nasiyani saqlashda xatolik yuz berdi', 'error');
    }
    })();
  };

  const filteredClients = state.clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const handleAddClientClick = () => {
    setOpen(true);
    setName('');
    setRawPhone('');
    setPhone('+998 ');
  };

  return (
    <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('clients')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClientClick} disabled={isRestricted}>{t('addClient')}</Button>
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
              isRestricted={isRestricted}
              onEdit={() => { setEditClient(c); setName(c.name); const digits = parsePhone(c.phone); setRawPhone(digits); setPhone(formatPhone(digits)); }}
              onDelete={() => handleDeleteClick(c.id)}
              onAddCredit={() => { 
                setCreditClient(c); 
                setCreditType('cash');
                setCreditSubtype('berilgan');
                setCreditAmount('');
                setInitialPayment('');
                setInitialPaymentCurrency('UZS');
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
        <DialogTitle>{t('enterAdminPassword')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{t('confirm_delete_client')}</Typography>
          <TextField
            autoFocus
            fullWidth
            type="password"
            label={t('password') || 'Parol'}
            value={confirm.password}
            onChange={(e) => setConfirm(s => ({ ...s, password: e.target.value }))}
            disabled={confirm.verifying}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm({ open: false, id: null, password: '', verifying: false })} disabled={confirm.verifying}>
            {t('cancel')}
          </Button>
          <Button 
            onClick={handlePasswordConfirm} 
            color="error" 
            variant="contained" 
            disabled={confirm.verifying || !confirm.password}
          >
            {confirm.verifying ? <CircularProgress size={24} /> : t('delete')}
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
            label={t('type')}
            fullWidth
            margin="dense"
            value={creditType}
            onChange={(e) => setCreditType(e.target.value)}
          >
            <MenuItem value="cash">{t('creditTypeMoney')}</MenuItem>
            <MenuItem value="product">{t('creditTypeProduct')}</MenuItem>
          </TextField>
          <TextField
            select
            label={t('type')}
            fullWidth
            margin="dense"
            value={creditSubtype}
            onChange={(e) => setCreditSubtype(e.target.value)}
          >
            <MenuItem value="olingan">{t('creditDirectionOlingan')}</MenuItem>
            <MenuItem value="berilgan">{t('creditDirectionBerish')}</MenuItem>
          </TextField>
          {creditType === 'cash' ? (
            <>
              <CurrencyField
                label={t('amount')}
                fullWidth
                margin="dense"
                value={creditAmount}
                onChange={(val) => setCreditAmount(val)}
                currency={creditCurrency}
              />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <CurrencyField
                  label={t('boshToluv')}
                  fullWidth
                  margin="dense"
                  value={initialPayment}
                  onChange={(val) => setInitialPayment(val)}
                  currency={initialPaymentCurrency}
                />
                <TextField
                  select
                  label={t('currency')}
                  margin="dense"
                  value={initialPaymentCurrency}
                  onChange={(e) => setInitialPaymentCurrency(e.target.value)}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="UZS">UZS</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                </TextField>
              </Box>
              <TextField
                select
                label={t('currency')}
                fullWidth
                margin="dense"
                value={creditCurrency}
                onChange={(e) => {
                  const next = e.target.value
                  if ((initialPaymentCurrency || 'UZS') === (creditCurrency || 'UZS')) {
                    setInitialPaymentCurrency(next)
                  }
                  setCreditCurrency(next)
                }}
              >
                <MenuItem value="UZS">UZS</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
              </TextField>
            </>
          ) : (
            <>
              <TextField
                select
                label={t('location')}
                fullWidth
                margin="dense"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <MenuItem value="warehouse">{t('warehouse')}</MenuItem>
                <MenuItem value="store">{t('store')}</MenuItem>
              </TextField>
              <Typography variant="subtitle1" sx={{ mt: 2 }}>Mahsulotlar</Typography>
              {products.map((p, index) => {
                const pool = location === 'warehouse' ? state.warehouse : state.store;
                const selected = pool.find(item => item.name === p.name);
                const derivedCategory = p.category || selected?.category;
                const isMeter = isMeterCategory(derivedCategory);
                const isElectrode = normalizeCategory(derivedCategory) === 'elektrod';
                const isStone = normalizeCategory(derivedCategory) === 'tosh';
                const isBerilganMeter = creditSubtype === 'berilgan' && isMeter;
                return (
                  <Grid container spacing={1} key={index} sx={{ mb: 2, alignItems: 'center' }}>
                    <Grid item xs={12} sm={4}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {p.isNewProduct ? (
                          <TextField
                            label={t('productName')}
                            fullWidth
                            margin="dense"
                            value={p.name}
                            onChange={(e) => updateProduct(index, 'name', e.target.value)}
                          />
                        ) : (
                          <TextField
                            select
                            label={t('selectProduct')}
                            fullWidth
                            margin="dense"
                            value={p.name}
                            onChange={(e) => updateProduct(index, 'name', e.target.value)}
                          >
                            <MenuItem value="">-- {t('selectProduct')} --</MenuItem>
                            {pool.map(item => (
                              <MenuItem key={item.id} value={item.name}>
                                {formatProductName(item) || item.name} (Mavjud: {isMeterCategory(item) ? `${item.meter_qty ?? (item.qty * (item.pack_qty||0))} m` : item.qty})
                              </MenuItem>
                            ))}
                          </TextField>
                        )}
                        <Checkbox
                          checked={p.isNewProduct || false}
                          onChange={(e) => updateProduct(index, 'isNewProduct', e.target.checked)}
                          inputProps={{ 'aria-label': 'Yangi mahsulot' }}
                        />
                      </Box>
                      {!p.isNewProduct && selected && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {`Kategoriya: ${selected.category || '-'} | ${formatProductName(selected)}`}
                        </Typography>
                      )}
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <NumberField
                        label={isElectrode ? 'Soni (pachka)' : t('miqdor')}
                        fullWidth
                        margin="dense"
                        value={p.qty}
                        onChange={(val) => updateProduct(index, 'qty', val)}
                      />
                    </Grid>
                    {p.isNewProduct && (
                      <>
                        <Grid item xs={6} sm={2}>
                          <TextField
                            select
                            label="Kategoriya"
                            fullWidth
                            margin="dense"
                            value={p.category}
                            onChange={(e) => updateProduct(index, 'category', normalizeCategory(e.target.value))}
                          >
                            <MenuItem value="">Tanlang</MenuItem>
                            {categories.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
                          </TextField>
                        </Grid>
                    {isElectrode && (
                      <>
                        <Grid item xs={6} sm={2}>
                          <TextField label="Razmer" fullWidth margin="dense" value={p.electrode_size} onChange={(e) => updateProduct(index, 'electrode_size', e.target.value)} />
                        </Grid>
                        <Grid item xs={6} sm={2}>
                          <CurrencyField label="Narxi (pachka)" fullWidth margin="dense" value={p.price_pack} onChange={(val) => updateProduct(index, 'price_pack', val)} currency={p.sellCurrency || 'UZS'} />
                        </Grid>
                      </>
                    )}
                        {isMeter && (
                          <Grid item xs={6} sm={2}>
                            <NumberField label="Metr (1 dona)" fullWidth margin="dense" value={p.pack_qty} onChange={(val) => updateProduct(index, 'pack_qty', val)} />
                          </Grid>
                        )}
                        {isStone && (
                          <>
                            <Grid item xs={6} sm={2}>
                              <TextField label="Qalinlik" fullWidth margin="dense" value={p.stone_thickness} onChange={(e) => updateProduct(index, 'stone_thickness', e.target.value)} />
                            </Grid>
                            <Grid item xs={6} sm={2}>
                              <TextField label="Hajmi" fullWidth margin="dense" value={p.stone_size} onChange={(e) => updateProduct(index, 'stone_size', e.target.value)} />
                            </Grid>
                          </>
                        )}
                      </>
                    )}
                    {creditSubtype === 'olingan' && !isMeter && (
                      <>
                        <Grid item xs={6} sm={2}>
                          <CurrencyField
                            label={isMeter ? 'Olingan narx (1 metr)' : 'Olingan narx'}
                            fullWidth
                            margin="dense"
                            value={p.receivePrice}
                            onChange={(val) => updateProduct(index, 'receivePrice', val)}
                            currency={p.receiveCurrency || 'UZS'}
                          />
                        </Grid>
                        <Grid item xs={6} sm={1}>
                          <TextField
                            select
                            label={t('currency')}
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
                    {isMeter ? (
                      <>
                        {!isBerilganMeter && (
                          <Grid item xs={6} sm={2}>
                            <CurrencyField
                              label="Metr narxi"
                              fullWidth
                              margin="dense"
                              value={p.sellPrice}
                              onChange={(val) => updateProduct(index, 'sellPrice', val)}
                              currency={p.sellCurrency || 'UZS'}
                            />
                          </Grid>
                        )}
                        <Grid item xs={6} sm={2}>
                          <CurrencyField
                            label="Dona narxi"
                            fullWidth
                            margin="dense"
                            value={p.price_piece}
                            onChange={(val) => updateProduct(index, 'price_piece', val)}
                            currency={p.sellCurrency || 'UZS'}
                          />
                        </Grid>
                        {isBerilganMeter && (
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">
                              {`Berilgan nasiya (metr mahsulot): faqat dona narxi talab qilinadi, metr narxi o'chirilgan.`}
                            </Typography>
                          </Grid>
                        )}
                      </>
                    ) : (
                      !isElectrode && (
                        <Grid item xs={6} sm={2}>
                          <CurrencyField
                            label={creditSubtype === 'olingan' ? "Aytilgan narx" : t('price')}
                            fullWidth
                            margin="dense"
                            value={p.sellPrice}
                            onChange={(val) => updateProduct(index, 'sellPrice', val)}
                            currency={p.sellCurrency || 'UZS'}
                          />
                        </Grid>
                      )
                    )}
                    <Grid item xs={6} sm={1}>
                      <TextField
                        select
                        label={t('currency')}
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
                );
              })}
              <Button onClick={addProduct} variant="outlined" sx={{ mt: 1 }}>Mahsulot qo'shish</Button>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <CurrencyField
                  label={t('boshToluv')}
                  fullWidth
                  margin="dense"
                  value={initialPayment}
                  onChange={(val) => setInitialPayment(val)}
                  currency={initialPaymentCurrency}
                />
                <TextField
                  select
                  label={t('currency')}
                  margin="dense"
                  value={initialPaymentCurrency}
                  onChange={(e) => setInitialPaymentCurrency(e.target.value)}
                  sx={{ minWidth: 120 }}
                >
                  <MenuItem value="UZS">UZS</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                </TextField>
              </Box>
            </>
          )}
          <TextField
            label={t('date')}
            type="date"
            fullWidth
            margin="dense"
            value={creditDate}
            onChange={(e) => setCreditDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t('note')}
            fullWidth
            margin="dense"
            value={creditNote}
            onChange={(e) => setCreditNote(e.target.value)}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreditOpen(false)}>{t('cancel')}</Button>
          <Button
            onClick={handleAddCredit}
            variant="contained"
            disabled={
              creditType === 'cash'
                ? !creditAmount
                : products.length === 0 || products.some(p => {
                    const cat = normalizeCategory(p.category || '')
                    const isMeter = isMeterCategory(cat || p)
                    const requiresReceive = p.isNewProduct && creditSubtype === 'olingan' && !isMeter
                    return !isProductFilled(p) || requiresReceive
                  })
            }
          >
            {t('add')}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
