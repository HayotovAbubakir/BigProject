
import React, { createContext, useReducer, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getClients, insertClient as dbInsertClient, updateClient as dbUpdateClient, deleteClient as dbDeleteClient } from '../firebase/supabaseClients'
import { getProducts, insertProduct as dbInsertProduct, updateProduct as dbUpdateProduct, deleteProduct as dbDeleteProduct } from '../firebase/supabaseInventory'
import { getCredits, insertCredit as dbInsertCredit, updateCredit as dbUpdateCredit, deleteCredit as dbDeleteCredit } from '../firebase/supabaseCredits'
import { getLogs, insertLog, insertCreditLog } from '../firebase/supabaseLogs'
import { getAllUserBalances } from '../firebase/supabaseAccounts'
import { supabase } from '/supabase/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from './NotificationContext';
import { DEFAULT_PRODUCT_CATEGORIES, PRODUCT_CATEGORIES_STORAGE_KEY, loadStoredProductCategories, mergeCategories, isMeterCategory } from '../utils/productCategories'

const lowStockJokes = [
  "{name} mahsuloti kam qoldi. Yetkazib berish vaqtini o'ylash kerak!",
  "Diqqat: {name} mahsuloti deyarli tugadi. Yangi zaxira kerak!",
  "{name} javoni bo'shab qolyapti. Xaridorlar so'rashi mumkin.",
  "Bizning {name} zaxiramiz juda kamayib ketdi.",
  "{name} mahsulotini tezroq to'ldirish kerak!"
];

const overdueCreditJokes = [
  "{name} nomidagi nasiya ancha vaqtdan beri turibdi. To'lovni so'rash kerak!",
  "Eslatma: {name} uchun nasiya to'lovi kechikyapti.",
  "{name} ga berilgan nasiya eskirib ketdi. Tarixiy asarga aylanmasidan undirish kerak.",
  "To'lovni tezlashtirish uchun {name} bilan bog'laning.",
  "Diqqat: {name} uchun nasiya muddati o'tib ketdi."
];

const initialState = {
  warehouse: [],
  store: [],
  logs: [],
  credits: [],
  exchangeRate: null, 
  
  ui: {
    dark: false,
    receiptRate: 13000,
    displayCurrency: localStorage.getItem('displayCurrency') || 'UZS',
    productCategories: loadStoredProductCategories(),
  },
  drafts: {},
  clients: [],

  accounts: [
    { username: 'hamdamjon', label: 'Hamdamjon', permissions: { credits_manage: true, wholesale_allowed: true, add_products: true, manage_accounts: true } },
    { username: 'habibjon', label: 'Habibjon', permissions: { credits_manage: true, wholesale_allowed: true, add_products: true, manage_accounts: true } },
  ],
}


const AppContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'INIT': {
      const payload = { ...action.payload }
      if (payload.accounts) {
        // Filter out shogirt and ensure developer accounts have no restrictions
        payload.accounts = payload.accounts
          .filter(a => a.username !== 'shogirt')
          .map(a => {
            const uname = (a.username || '').toString().toLowerCase()
            const role = (a.role || '').toString().toLowerCase()
            const isDeveloper = role === 'developer' || uname === 'developer'
            if (isDeveloper) {
              return {
                ...a,
                permissions: {
                  ...a.permissions,
                  new_account_restriction: false
                }
              }
            }
            return a
          })
      }
      return { ...state, ...payload }
    }
    case 'SET_EXCHANGE_RATE':
      return { ...state, exchangeRate: action.payload }
    case 'ADD_WAREHOUSE':
      return { ...state, warehouse: [...state.warehouse, action.payload], logs: [...state.logs, action.log] }
    case 'MOVE_TO_STORE': {
      const isMeter = isMeterCategory(action.payload?.item?.category)
      if (isMeter) {
        const packQty = Number(action.payload?.pack_qty ?? action.payload?.item?.pack_qty ?? 0)
        const meterDelta = Number(action.payload?.meter_qty ?? action.payload?.meter ?? 0)
        const nextWarehouse = state.warehouse.map((it) => {
          if (it.id !== action.payload.id) return it
          const baseMeter = Number(it.meter_qty ?? (Number(it.qty || 0) * packQty))
          const newMeter = Math.max(0, baseMeter - meterDelta)
          const newQty = packQty > 0 ? Math.ceil(newMeter / packQty) : Math.max(0, Number(it.qty || 0) - Number(action.payload.qty || 0))
          return { ...it, meter_qty: newMeter, qty: newQty }
        })
        const filteredWh = nextWarehouse.filter(w => isMeterCategory(w.category) ? Number(w.meter_qty || 0) > 0 : Number(w.qty) > 0)

        const existingStore = state.store.find(s => s.id === action.payload.item?.id)
        let newStore
        if (existingStore) {
          const baseMeter = Number(existingStore.meter_qty ?? (Number(existingStore.qty || 0) * packQty))
          const mergedMeter = baseMeter + meterDelta
          const mergedQty = packQty > 0 ? Math.ceil(mergedMeter / packQty) : Number(existingStore.qty || 0) + Number(action.payload.qty || 0)
          newStore = state.store.map(s => s.id === existingStore.id ? { ...s, meter_qty: mergedMeter, qty: mergedQty } : s)
        } else {
          const newQty = packQty > 0 ? Math.ceil(meterDelta / packQty) : Number(action.payload.qty || 0)
          const itemToAdd = { ...action.payload.item, meter_qty: meterDelta, qty: newQty }
          newStore = [...state.store, itemToAdd]
        }
        return { ...state, warehouse: filteredWh, store: newStore, logs: [...state.logs, action.log] }
      }

      const whUpdated = state.warehouse.map((it) => (it.id === action.payload.id ? { ...it, qty: Number(it.qty) - Number(action.payload.qty) } : it))
      const filteredWh = whUpdated.filter(w => Number(w.qty) > 0)

      const moveQty = Number(action.payload.qty)
      const itemToAdd = { ...action.payload.item, qty: Number(action.payload.item.qty) }

      const existingStore = state.store.find(s => s.id === itemToAdd.id)
      let newStore
      if (existingStore) {
        newStore = state.store.map(s => s.id === existingStore.id ? { ...s, qty: Number(s.qty) + moveQty } : s)
      } else {
        newStore = [...state.store, itemToAdd]
      }
      return { ...state, warehouse: filteredWh, store: newStore, logs: [...state.logs, action.log] }
    }
    case 'SELL_STORE': {
      const sold = state.store.map((it) => {
        if (it.id !== action.payload.id) return it
        if (isMeterCategory(it.category) && action.payload.meter_qty != null) {
          const packQty = Number(it.pack_qty || 0)
          const baseMeter = Number(it.meter_qty ?? (Number(it.qty || 0) * packQty))
          const newMeter = Math.max(0, baseMeter - Number(action.payload.meter_qty))
          const newQty = packQty > 0 ? Math.ceil(newMeter / packQty) : Math.max(0, Number(it.qty || 0) - Number(action.payload.qty || 0))
          return { ...it, meter_qty: newMeter, qty: newQty }
        }
        return { ...it, qty: Number(it.qty) - Number(action.payload.qty) }
      })
      const filteredStore = sold.filter(s => isMeterCategory(s.category) ? Number(s.meter_qty || 0) > 0 : Number(s.qty) > 0)
      // update account balances (credit the selling account) when a sale happens
      try {
        const log = action.log || {}
        const uname = (log.user_name || '').toString().toLowerCase()
        let deltaUzs = null
        if (typeof log.total_uzs !== 'undefined' && log.total_uzs !== null) deltaUzs = Number(log.total_uzs)
        else if ((log.currency || '').toString().toUpperCase() === 'UZS') deltaUzs = Math.round(Number(log.amount || 0))
        else if ((log.currency || '').toString().toUpperCase() === 'USD' && state.exchangeRate) deltaUzs = Math.round(Number(log.amount || 0) * Number(state.exchangeRate))

        let nextAccounts = state.accounts
        if (deltaUzs !== null && uname) {
          nextAccounts = (state.accounts || []).map(a => {
            if ((a.username || '').toString().toLowerCase() === uname) {
              const prev = Number(a.balance_uzs || 0)
              return { ...a, balance_uzs: prev + Number(deltaUzs) }
            }
            return a
          })
        }
        return { ...state, store: filteredStore, logs: [...state.logs, action.log], accounts: nextAccounts }
      } catch (_err) {
        void _err
        return { ...state, store: filteredStore, logs: [...state.logs, action.log] }
      }
    }
    case 'SELL_WAREHOUSE': {
      const soldWh = state.warehouse.map((it) => {
        if (it.id !== action.payload.id) return it
        if (isMeterCategory(it.category) && action.payload.meter_qty != null) {
          const packQty = Number(it.pack_qty || 0)
          const baseMeter = Number(it.meter_qty ?? (Number(it.qty || 0) * packQty))
          const newMeter = Math.max(0, baseMeter - Number(action.payload.meter_qty))
          const newQty = packQty > 0 ? Math.ceil(newMeter / packQty) : Math.max(0, Number(it.qty || 0) - Number(action.payload.qty || 0))
          return { ...it, meter_qty: newMeter, qty: newQty }
        }
        return { ...it, qty: Number(it.qty) - Number(action.payload.qty) }
      })
      const filteredWh = soldWh.filter(w => isMeterCategory(w.category) ? Number(w.meter_qty || 0) > 0 : Number(w.qty) > 0)
      // also credit the selling account (if present) for warehouse sales
      try {
        const log = action.log || {}
        const uname = (log.user_name || '').toString().toLowerCase()
        let deltaUzs = null
        if (typeof log.total_uzs !== 'undefined' && log.total_uzs !== null) deltaUzs = Number(log.total_uzs)
        else if ((log.currency || '').toString().toUpperCase() === 'UZS') deltaUzs = Math.round(Number(log.amount || 0))
        else if ((log.currency || '').toString().toUpperCase() === 'USD' && state.exchangeRate) deltaUzs = Math.round(Number(log.amount || 0) * Number(state.exchangeRate))

        let nextAccounts = state.accounts
        if (deltaUzs !== null && uname) {
          nextAccounts = (state.accounts || []).map(a => {
            if ((a.username || '').toString().toLowerCase() === uname) {
              const prev = Number(a.balance_uzs || 0)
              return { ...a, balance_uzs: prev + Number(deltaUzs) }
            }
            return a
          })
        }
        return { ...state, warehouse: filteredWh, logs: [...state.logs, action.log], accounts: nextAccounts }
      } catch (_err) {
        void _err
        return { ...state, warehouse: filteredWh, logs: [...state.logs, action.log] }
      }
    }
    case 'ADD_STORE':
      return { ...state, store: [...state.store, action.payload], logs: [...state.logs, action.log] }
    case 'DELETE_STORE':
      return { ...state, store: state.store.filter(s => s.id !== action.payload.id), logs: [...state.logs, action.log] }
    case 'EDIT_STORE':
      return { ...state, store: state.store.map(s => s.id === action.payload.id ? { ...s, ...action.payload.updates } : s), logs: [...state.logs, action.log] }
    case 'ADD_CREDIT':
      return { ...state, credits: [action.payload, ...state.credits], logs: [...state.logs, action.log] }
    case 'DELETE_WAREHOUSE':
      return { ...state, warehouse: state.warehouse.filter(w => w.id !== action.payload.id), logs: [...state.logs, action.log] }
    case 'EDIT_WAREHOUSE':
      return { ...state, warehouse: state.warehouse.map(w => w.id === action.payload.id ? { ...w, ...action.payload.updates } : w), logs: [...state.logs, action.log] }
    case 'ADJUST_WAREHOUSE_QTY':
      return { ...state, warehouse: state.warehouse.map(w => w.id === action.payload.id ? { ...w, qty: Math.max(0, Number(w.qty || 0) + Number(action.payload.delta || 0)) } : w), logs: [...state.logs, action.log] }
    case 'ADJUST_STORE_QTY':
      return { ...state, store: state.store.map(s => s.id === action.payload.id ? { ...s, qty: Math.max(0, Number(s.qty || 0) + Number(action.payload.delta || 0)) } : s), logs: [...state.logs, action.log] }
    case 'DELETE_CREDIT':
      return { ...state, credits: state.credits.filter(c => c.id !== action.payload.id), logs: [...state.logs, action.log] }
    case 'EDIT_CREDIT':
      return { ...state, credits: state.credits.map(c => c.id === action.payload.id ? { ...c, ...action.payload.updates } : c), logs: [...state.logs, action.log] }
    case 'SET_CREDITS':
      return { ...state, credits: action.payload }
    case 'SET_STORE':
      return { ...state, store: action.payload }
    case 'SET_WAREHOUSE':
      return { ...state, warehouse: action.payload }
    case 'SET_LOGS':
      return { ...state, logs: action.payload }
    case 'SET_CLIENTS':
      return { ...state, clients: action.payload }
    case 'SET_USER':
      return { ...state, user: action.payload }
    case 'ADD_ACCOUNT':
      try {
        const uname = (action.payload && action.payload.username || '').toString().toLowerCase()
        const existing = (state.accounts || []).find(a => (a.username || '').toString().toLowerCase() === uname)
        if (existing) return state
        const cleanPayload = { ...action.payload, username: uname }
        const newState = { ...state, accounts: [...state.accounts, cleanPayload], logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${cleanPayload.username} added` }] }
        // syncState(newState)
        return newState
      } catch (_ignore) {
        void _ignore
        const newState = { ...state, accounts: [...state.accounts, action.payload], logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${action.payload.username} added` }] }
        // syncState(newState)
        return newState
      }
    case 'ADD_CLIENT':
      try {
        const cleanPayload = { ...action.payload }
        const existing = (state.clients || []).find(c => c.id === cleanPayload.id)
        if (existing) return state
        return { ...state, clients: [...(state.clients || []), cleanPayload], logs: [...state.logs, action.log || { ts: Date.now(), action: `Client ${cleanPayload.name} added` }] }
      } catch (_ignore) {
        void _ignore
        return { ...state, clients: [...(state.clients || []), action.payload], logs: [...state.logs, action.log || { ts: Date.now(), action: `Client ${action.payload.name} added` }] }
      }
    case 'EDIT_CLIENT': {
      const id = action.payload.id
      return { ...state, clients: (state.clients || []).map(c => c.id === id ? { ...c, ...action.payload.updates } : c), logs: [...state.logs, action.log || { ts: Date.now(), action: `Client ${action.payload.id} edited` }] }
    }
    case 'DELETE_CLIENT': {
      const id = action.payload.id
      return { ...state, clients: (state.clients || []).filter(c => c.id !== id), logs: [...state.logs, action.log || { ts: Date.now(), action: `Client ${action.payload.id} deleted` }] }
    }
    case 'SET_UI':
      try {
        const nextUi = { ...state.ui, ...(action.payload || {}) }
        
        if (JSON.stringify(nextUi) === JSON.stringify(state.ui)) return state
        return { ...state, ui: nextUi }
      } catch (_ignore) {
        void _ignore
        return { ...state, ui: { ...state.ui, ...(action.payload || {}) } }
      }
    case 'SET_DRAFT': {
      const { key, value } = action.payload || {}
      if (!key) return state
      try {
        const existing = (state.drafts || {})[key]
        if (JSON.stringify(existing) === JSON.stringify(value)) return state
      } catch (_ignore) {
        void _ignore
      }
      return { ...state, drafts: { ...(state.drafts || {}), [key]: value } }
    }
    case 'CLEAR_DRAFT': {
      const { key } = action.payload || {}
      if (!key) return state
      if (!state.drafts || !(key in state.drafts)) return state
      const next = { ...(state.drafts || {}) }
      delete next[key]
      return { ...state, drafts: next }
    }
    case 'EDIT_ACCOUNT': {
      const uname = (action.payload.username || '').toString().toLowerCase()
      const actorRole = (action.payload.actorRole || '').toString().toLowerCase()
      const actorUser = (action.payload.user || '').toString().toLowerCase()
      const actorIsDeveloper = actorRole === 'developer' || actorUser === 'developer'
      if (uname === 'developer') return state // Prevent developer account from being edited
      if ((uname === 'hamdamjon' || uname === 'habibjon') && !actorIsDeveloper) return state
      return { ...state, accounts: state.accounts.map(a => ((a.username || '').toString().toLowerCase() === uname) ? { ...a, ...action.payload.updates } : a), logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${action.payload.username} edited` }] }
    }
    case 'DELETE_LOGS_FOR_DATE': {
      try {
        const date = (action.payload && action.payload.date) || ''
        const user = (action.payload && action.payload.user) || 'unknown'
        const uname = (user || '').toString().toLowerCase()
        if (uname !== 'hamdamjon' && uname !== 'habibjon' && uname !== 'developer') return state
        const remaining = (state.logs || []).filter(l => (l.date || '').toString().slice(0, 10) !== date)
        return { ...state, logs: [...remaining, { ts: Date.now(), action: `Logs for ${date} deleted by ${user}` }] }
      } catch (_err) {
        void _err
        return state
      }
    }
    case 'DELETE_ACCOUNT': {
      const uname = (action.payload.username || '').toString().toLowerCase()
      const actorRole = (action.payload.actorRole || '').toString().toLowerCase()
      const actorUser = (action.payload.user || '').toString().toLowerCase()
      const actorIsDeveloper = actorRole === 'developer' || actorUser === 'developer'
      if (uname === 'developer') return state // Prevent developer account from being deleted
      if ((uname === 'hamdamjon' || uname === 'habibjon') && !actorIsDeveloper) return state
      const newState = { ...state, accounts: state.accounts.filter(a => (a.username || '').toString().toLowerCase() !== uname), logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${action.payload.username} deleted` }] }
      // syncState(newState)
      return newState
    }
    case 'SET_ACCOUNTS':
      const newState = { ...state, accounts: action.payload }
      // syncState(newState)
      return newState
    case 'RESET_STATE':
      return { ...initialState, ui: state.ui }
    default:
      return state
  }
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { user, username, hasPermission } = useAuth()
  const { notify } = useNotification()
  const [hydrated, setHydrated] = React.useState(false)
  const mountedRef = useRef(true)
  const normalizeProductName = React.useCallback((value) => {
    return (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  }, [])
  const isDuplicateProductNameError = React.useCallback((err) => {
    const msg = (err?.message || err?.details || err?.error || '').toString().toLowerCase()
    return msg.includes('products_name_key') || msg.includes('duplicate key value')
  }, [])
  
  React.useEffect(() => {
    mountedRef.current = true;
    const loadData = async () => {
      if (!username) {
        if (mountedRef.current) setHydrated(false)
        dispatch({ type: 'RESET_STATE' })
        return
      }
      try {
        const [credits, warehouse, store, logs, clients, userBalances] = await Promise.all([
          getCredits(),
          getProducts('warehouse'),
          getProducts('store'),
          getLogs(),
          getClients(),
          getAllUserBalances(),
        ]);

        if (!mountedRef.current) return;

        dispatch({ type: 'SET_CREDITS', payload: credits });
        dispatch({ type: 'SET_WAREHOUSE', payload: warehouse });
        dispatch({ type: 'SET_STORE', payload: store });
        dispatch({ type: 'SET_LOGS', payload: logs });
        dispatch({ type: 'SET_CLIENTS', payload: clients });

        // Merge user balances with existing accounts
        if (userBalances && userBalances.length > 0) {
          console.log('[AppContext] Loaded user accounts:', userBalances);
          dispatch({ type: 'SET_ACCOUNTS', payload: userBalances });
        }

      } catch (_err) {
        console.error('AppContext: failed to load shared data', _err);
      }

      if (mountedRef.current) setHydrated(true);
    };

    loadData();

    return () => {
      mountedRef.current = false;
    };
  }, [username]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const merged = mergeCategories(state.ui?.productCategories || [], DEFAULT_PRODUCT_CATEGORIES)
      localStorage.setItem(PRODUCT_CATEGORIES_STORAGE_KEY, JSON.stringify(merged))
    } catch (_err) {
      void _err
    }
  }, [state.ui?.productCategories])

  const [syncState, setSyncState] = React.useState('idle')
  
  
  // Action creators with DB persistence
  const addWarehouseProduct = React.useCallback(async (payload, logData) => {
    try {
      const targetName = normalizeProductName(payload?.name)
      const existingWarehouse = (state.warehouse || []).find(p => normalizeProductName(p.name) === targetName)
      const existingStore = (state.store || []).find(p => normalizeProductName(p.name) === targetName)

      if (existingWarehouse) {
        const newQty = Number(existingWarehouse.qty || 0) + Number(payload.qty || 0)
        const updates = { qty: newQty }
        const data = await dbUpdateProduct(existingWarehouse.id, updates)
        let log = null
        try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (warehouse add-merge), continuing', e) }
        dispatch({ type: 'EDIT_WAREHOUSE', payload: { id: existingWarehouse.id, updates: data || updates }, log })
        notify('Diqqat', 'Mahsulot allaqachon omborda bor edi. Miqdoriga qo\'shildi.', 'warning')
        return data
      }

      if (existingStore) {
        notify('Xato', 'Bu nomdagi mahsulot do\'konda bor. Iltimos o\'sha joyda miqdor qo\'shing yoki nomini o\'zgartiring.', 'error')
        throw new Error('Product already exists in store')
      }

      const product = await dbInsertProduct({ ...payload, location: 'warehouse' })
      let log = null
      try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (warehouse add), continuing', e) }
      dispatch({ type: 'ADD_WAREHOUSE', payload: product, log })
    } catch (_err) {
      if (isDuplicateProductNameError(_err)) {
        const targetName = normalizeProductName(payload?.name)
        const existingWarehouse = (state.warehouse || []).find(p => normalizeProductName(p.name) === targetName)
        const existingStore = (state.store || []).find(p => normalizeProductName(p.name) === targetName)
        if (existingWarehouse) {
          const newQty = Number(existingWarehouse.qty || 0) + Number(payload.qty || 0)
          const updates = { qty: newQty }
          const data = await dbUpdateProduct(existingWarehouse.id, updates)
          let log = null
          try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (warehouse add-merge), continuing', e) }
          dispatch({ type: 'EDIT_WAREHOUSE', payload: { id: existingWarehouse.id, updates: data || updates }, log })
          notify('Diqqat', 'Mahsulot allaqachon omborda bor edi. Miqdoriga qo\'shildi.', 'warning')
          return data
        }
        if (existingStore) {
          notify('Xato', 'Bu nomdagi mahsulot do\'konda bor. Iltimos o\'sha joyda miqdor qo\'shing yoki nomini o\'zgartiring.', 'error')
        }
      }
      const message = `Failed to add warehouse product: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify, normalizeProductName, isDuplicateProductNameError, state.store, state.warehouse])

  const addStoreProduct = React.useCallback(async (payload, logData) => {
    try {
      const targetName = normalizeProductName(payload?.name)
      const existingStore = (state.store || []).find(p => normalizeProductName(p.name) === targetName)
      const existingWarehouse = (state.warehouse || []).find(p => normalizeProductName(p.name) === targetName)

      if (existingStore) {
        const newQty = Number(existingStore.qty || 0) + Number(payload.qty || 0)
        const updates = { qty: newQty }
        const data = await dbUpdateProduct(existingStore.id, updates)
        let log = null
        try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (store add-merge), continuing', e) }
        dispatch({ type: 'EDIT_STORE', payload: { id: existingStore.id, updates: data || updates }, log })
        notify('Diqqat', 'Mahsulot allaqachon do\'konda bor edi. Miqdoriga qo\'shildi.', 'warning')
        return data
      }

      if (existingWarehouse) {
        notify('Xato', 'Bu nomdagi mahsulot omborda bor. Iltimos o\'sha joyda miqdor qo\'shing yoki nomini o\'zgartiring.', 'error')
        throw new Error('Product already exists in warehouse')
      }

      const product = await dbInsertProduct({ ...payload, location: 'store' })
      let log = null
      try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (store add), continuing', e) }
      dispatch({ type: 'ADD_STORE', payload: product, log })
    } catch (_err) {
      if (isDuplicateProductNameError(_err)) {
        const targetName = normalizeProductName(payload?.name)
        const existingStore = (state.store || []).find(p => normalizeProductName(p.name) === targetName)
        const existingWarehouse = (state.warehouse || []).find(p => normalizeProductName(p.name) === targetName)
        if (existingStore) {
          const newQty = Number(existingStore.qty || 0) + Number(payload.qty || 0)
          const updates = { qty: newQty }
          const data = await dbUpdateProduct(existingStore.id, updates)
          let log = null
          try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (store add-merge), continuing', e) }
          dispatch({ type: 'EDIT_STORE', payload: { id: existingStore.id, updates: data || updates }, log })
          notify('Diqqat', 'Mahsulot allaqachon do\'konda bor edi. Miqdoriga qo\'shildi.', 'warning')
          return data
        }
        if (existingWarehouse) {
          notify('Xato', 'Bu nomdagi mahsulot omborda bor. Iltimos o\'sha joyda miqdor qo\'shing yoki nomini o\'zgartiring.', 'error')
        }
      }
      const message = `Failed to add store product: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify, normalizeProductName, isDuplicateProductNameError, state.store, state.warehouse])

  const updateWarehouseProduct = React.useCallback(async (id, updates, logData) => {
    let data = updates; // fallback to updates if DB fails
    try {
      data = await dbUpdateProduct(id, updates)
    } catch (_err) {
      const message = `Failed to update warehouse product in database: ${_err.message}. Local state updated.`;
      notify('Warning', message, 'warning')
      // Don't throw, continue to update local state
    }
    let log = null
    try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (warehouse update), continuing', e) }
    dispatch({ type: 'EDIT_WAREHOUSE', payload: { id, updates: data }, log })
  }, [dispatch, notify])

  const updateStoreProduct = React.useCallback(async (id, updates, logData) => {
    let data = updates; // fallback to updates if DB fails
    try {
      data = await dbUpdateProduct(id, updates)
    } catch (_err) {
      const message = `Failed to update store product in database: ${_err.message}. Local state updated.`;
      notify('Warning', message, 'warning')
      // Don't throw, continue to update local state
    }
    let log = null
    try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (store update), continuing', e) }
    dispatch({ type: 'EDIT_STORE', payload: { id, updates: data }, log })
  }, [dispatch, notify])

  const deleteWarehouseProduct = React.useCallback(async (id, logData) => {
    try {
      await dbDeleteProduct(id)
      let log = null
      try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (warehouse delete), continuing', e) }
      dispatch({ type: 'DELETE_WAREHOUSE', payload: { id }, log })
    } catch (_err) {
      const message = `Failed to delete warehouse product: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify])

  const deleteStoreProduct = React.useCallback(async (id, logData) => {
    try {
      await dbDeleteProduct(id)
      let log = null
      try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (store delete), continuing', e) }
      dispatch({ type: 'DELETE_STORE', payload: { id }, log })
    } catch (_err) {
      const message = `Failed to delete store product: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify])

  const sellStoreProduct = React.useCallback(async (item, { id, qty, deduct_qty, price, currency }, logData) => {
    try {
      const effectiveQty = Number(deduct_qty ?? qty ?? 0);
      const newQty = Number(item.qty) - effectiveQty;
      await dbUpdateProduct(id, { qty: newQty });
      let log = null
      try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (sell store), continuing', e) }
      dispatch({ type: 'SELL_STORE', payload: { id, qty: effectiveQty }, log });
    } catch (err) {
      const message = `Failed to sell store product: ${err.message}`;
      notify('Error', message, 'error')
      throw err;
    }
  }, [dispatch, notify]);

  const addCredit = React.useCallback(async (payload, logData) => {
    try {
      // ensure created_by and created_at for credits (site-wide)
      payload.created_by = payload.created_by || username || 'shared'
      payload.created_at = payload.created_at || new Date().toISOString()
      const credit = await dbInsertCredit(payload)

      // Normalize log payload for insertion and try both RPC and direct insert.
      const normalizedLog = {
        id: (logData && logData.id) || uuidv4(),
        date: (logData && logData.date) || (payload.date || new Date().toISOString().slice(0, 10)),
        time: (logData && logData.time) || new Date().toLocaleTimeString(),
        user_name: (logData && (logData.user_name || logData.user)) || username || 'unknown',
        action: (logData && (logData.action || 'CREDIT_ADD')),
        kind: 'credit',
        product_name: logData?.product_name || logData?.productName || payload.product_name || payload.name || null,
        qty: logData?.qty ?? payload.qty ?? 1,
        unit_price: logData?.unit_price ?? logData?.price ?? payload.unit_price ?? payload.price ?? payload.amount ?? null,
        amount: logData?.amount ?? payload.amount ?? null,
        currency: logData?.currency ?? payload.currency ?? 'UZS',
        client_name: logData?.client_name ?? payload.name ?? null,
        bosh_toluv: logData?.bosh_toluv ?? logData?.down_payment ?? payload.bosh_toluv ?? 0,
        credit_type: logData?.credit_type ?? payload.credit_type ?? payload.type ?? null,
        detail: logData?.detail || null
      }

      let returnedLog = null
      try {
        // try credit-specific RPC/fallback
        returnedLog = await insertCreditLog(normalizedLog)
      } catch (e) {
        console.warn('insertCreditLog failed (add credit), will try insertLog fallback', e)
      }

      if (!returnedLog) {
        try {
          returnedLog = await insertLog(normalizedLog)
        } catch (e) {
          console.warn('insertLog failed (add credit), continuing with local state update', e)
        }
      }

      // Use the returned log if available, otherwise fall back to the normalized local log
      const finalLog = returnedLog || normalizedLog
      dispatch({ type: 'ADD_CREDIT', payload: credit, log: finalLog })
      return credit
    } catch (_err) {
      const message = `Failed to add credit: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, username, notify])

  const updateCredit = React.useCallback(async (id, updates, logData) => {
    try {
      const data = await dbUpdateCredit(id, updates)
      insertLog(logData).catch(e => console.warn('insertLog failed (edit credit), continuing with local state update', e))
      dispatch({ type: 'EDIT_CREDIT', payload: { id, updates: data }, log: logData })
    } catch (_err) {
      const message = `Failed to update credit: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify])

  const deleteCredit = React.useCallback(async (id, logData) => {
    try {
      await dbDeleteCredit(id)
      insertLog(logData).catch(e => console.warn('insertLog failed (delete credit), continuing with local state update', e))
      dispatch({ type: 'DELETE_CREDIT', payload: { id }, log: logData })
    } catch (_err) {
      const message = `Failed to delete credit: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify])

  const addClient = React.useCallback(async (payload, logData) => {
    try {
      const client = await dbInsertClient(payload)
      const log = await insertLog(logData)
      dispatch({ type: 'ADD_CLIENT', payload: client, log })
    } catch (_err) {
      const message = `Failed to add client: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify])

  const updateClient = React.useCallback(async (id, updates, logData) => {
    try {
      await dbUpdateClient(id, updates)
      const log = await insertLog(logData)
      dispatch({ type: 'EDIT_CLIENT', payload: { id, updates }, log })
    } catch (_err) {
      const message = `Failed to update client: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify])

  const deleteClient = React.useCallback(async (id, logData) => {
    try {
      await dbDeleteClient(id)
      const log = await insertLog(logData)
      dispatch({ type: 'DELETE_CLIENT', payload: { id }, log })
    } catch (_err) {
      const message = `Failed to delete client: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify])

  const NOTIFIED_KEY = 'bigproject_notified'
  const notifiedItems = useRef(new Set(JSON.parse(typeof window !== 'undefined' ? (sessionStorage.getItem(NOTIFIED_KEY) || '[]') : '[]')))
  const initializedRef = useRef(false)

  // scan for overdue credits (older than 1 week) and notify once
  React.useEffect(() => {
    if (!hydrated) return;

    const checkNotifications = () => {
      const now = Date.now();
      const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;

      // Collect current low-stock and overdue IDs
      const lowStockIds = []
      ;[...(state.store || []), ...(state.warehouse || [])].forEach(p => {
        if (!p) return
        const isMeter = isMeterCategory(p.category)
        const meterQty = Number(p.meter_qty ?? (Number(p.pack_qty || 0) * Number(p.qty || 0)))
        const qtyValue = isMeter ? meterQty : Number(p.qty || 0)
        const threshold = isMeter ? 5 : 2
        if (qtyValue <= threshold) lowStockIds.push(p.id)
      })

      const overdueIds = []
      ;(state.credits || []).forEach(c => {
        if (!c) return
        const createdAt = c.created_at ? new Date(c.created_at).getTime() : 0
        if (!c.completed && createdAt > 0 && (now - createdAt > ONE_WEEK)) overdueIds.push(c.id)
      })

      // On first run after load, don't spam notifications — treat existing low/overdue as already-notified
      if (!initializedRef.current) {
        lowStockIds.forEach(id => { if (id) notifiedItems.current.add(id) })
        overdueIds.forEach(id => { if (id) notifiedItems.current.add(`credit:${id}`) })
        try { sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(notifiedItems.current))) } catch (e) { /* ignore */ }
        initializedRef.current = true
        return
      }

      // Low stock notifications (only new ones) - 3 different notification types
      ;[...(state.store || []), ...(state.warehouse || [])].forEach(p => {
        if (!p) return
        const isMeter = isMeterCategory(p.category)
        const meterQty = Number(p.meter_qty ?? (Number(p.pack_qty || 0) * Number(p.qty || 0)))
        const qtyValue = isMeter ? meterQty : Number(p.qty || 0)
        const threshold = isMeter ? 5 : 2
        if (qtyValue <= threshold && !notifiedItems.current.has(p.id)) {
          const randomJoke = lowStockJokes[Math.floor(Math.random() * lowStockJokes.length)];
          
          // Rotate through 3 different notification types
          const notifTypeIndex = Array.from(notifiedItems.current).length % 3;
          let severity = 'warning';
          let title = 'Low Stock!';
          
          if (notifTypeIndex === 1) {
            severity = 'success';
            title = '📉 Mahsulot kam qoldi';
          } else if (notifTypeIndex === 2) {
            severity = 'error';
            title = '⚠️ Kritik seviye';
          }
          
          notify(title, randomJoke.replace('{name}', p.name), severity);
          notifiedItems.current.add(p.id);
        }
      })

      // Overdue credits notifications (only new ones)
      ;(state.credits || []).forEach(c => {
        if (!c) return
        const key = `credit:${c.id}`
        if (!c.completed && !notifiedItems.current.has(key)) {
          const createdAt = c.created_at ? new Date(c.created_at).getTime() : 0;
          if (createdAt > 0 && (now - createdAt > ONE_WEEK)) {
            const randomJoke = overdueCreditJokes[Math.floor(Math.random() * overdueCreditJokes.length)];
            notify('Overdue Credit!', randomJoke.replace('{name}', c.name), 'error');
            notifiedItems.current.add(key);
          }
        }
      })

      try { sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(notifiedItems.current))) } catch (e) { /* ignore */ }
    };

    const interval = setInterval(checkNotifications, 1000 * 60 * 5); // Check every 5 minutes
    checkNotifications(); // Also check on load (will not spam on first run)

    return () => clearInterval(interval);
  }, [state.credits, state.store, state.warehouse, hydrated, notify]);

  const value = React.useMemo(() => ({ 
    state, 
    dispatch,
    syncState, 
    isOnline: navigator.onLine,
    // Action creators
    addWarehouseProduct,
    addStoreProduct,
    updateWarehouseProduct,
    updateStoreProduct,
    deleteWarehouseProduct,
    deleteStoreProduct,
    sellStoreProduct,
    addCredit,
    updateCredit,
    deleteCredit,
    addClient,
    updateClient,
    deleteClient
  }), [state, dispatch, syncState, addWarehouseProduct, addStoreProduct, updateWarehouseProduct, updateStoreProduct, deleteWarehouseProduct, deleteStoreProduct, sellStoreProduct, addCredit, updateCredit, deleteCredit, addClient, updateClient, deleteClient])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
export { AppContext }
