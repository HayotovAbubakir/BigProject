
import React, { createContext, useReducer, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getClients, insertClient as dbInsertClient, updateClient as dbUpdateClient, deleteClient as dbDeleteClient } from '../firebase/supabaseClients'
import { getProducts, insertProduct as dbInsertProduct, updateProduct as dbUpdateProduct, deleteProduct as dbDeleteProduct } from '../firebase/supabaseInventory'
import { getCredits, insertCredit as dbInsertCredit, updateCredit as dbUpdateCredit, deleteCredit as dbDeleteCredit } from '../firebase/supabaseCredits'
import { getLogs, insertLog, insertCreditLog } from '../firebase/supabaseLogs'
import { getAllUserBalances, updateAccountBalance, updateDailySales } from '../firebase/supabaseAccounts'
import { supabase, isSupabaseConfigured } from '/supabase/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from './NotificationContext';
import { DEFAULT_PRODUCT_CATEGORIES, PRODUCT_CATEGORIES_STORAGE_KEY, loadStoredProductCategories, mergeCategories, isMeterCategory, normalizeProductCategoryRecord, normalizeCategory } from '../utils/productCategories'
import { getConnectionInfo, isSlowConnection, safeLimit } from '../utils/network'

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

const PENDING_SYNC_KEY = 'bigproject_pending_ops'


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
      const isMeter = isMeterCategory(action.payload?.item)
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
        return { ...state, warehouse: nextWarehouse, store: newStore, logs: [...state.logs, action.log] }
      }

      const whUpdated = state.warehouse.map((it) => (it.id === action.payload.id ? { ...it, qty: Math.max(0, Number(it.qty) - Number(action.payload.qty)) } : it))

      const moveQty = Number(action.payload.qty)
      const itemToAdd = { ...action.payload.item, qty: Number(action.payload.item.qty) }

      const existingStore = state.store.find(s => s.id === itemToAdd.id)
      let newStore
      if (existingStore) {
        newStore = state.store.map(s => s.id === existingStore.id ? { ...s, qty: Math.max(0, Number(s.qty) + moveQty) } : s)
      } else {
        newStore = [...state.store, itemToAdd]
      }
      return { ...state, warehouse: whUpdated, store: newStore, logs: [...state.logs, action.log] }
    }
    case 'SELL_STORE': {
      const sold = state.store.map((it) => {
        if (it.id !== action.payload.id) return it
        if (isMeterCategory(it) && action.payload.meter_qty != null) {
          const packQty = Number(it.pack_qty || 0)
          const baseMeter = Number(it.meter_qty ?? (Number(it.qty || 0) * packQty))
          const newMeter = Math.max(0, baseMeter - Number(action.payload.meter_qty))
          const newQty = packQty > 0 ? Math.ceil(newMeter / packQty) : Math.max(0, Number(it.qty || 0) - Number(action.payload.qty || 0))
          return { ...it, meter_qty: newMeter, qty: newQty }
        }
        return { ...it, qty: Number(it.qty) - Number(action.payload.qty) }
      })
      const filteredStore = sold
      const nextLogs = action.log ? [...state.logs, action.log] : state.logs
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
        return { ...state, store: filteredStore, logs: nextLogs, accounts: nextAccounts }
      } catch (_err) {
        void _err
        return { ...state, store: filteredStore, logs: nextLogs }
      }
    }
    case 'SELL_WAREHOUSE': {
      const soldWh = state.warehouse.map((it) => {
        if (it.id !== action.payload.id) return it
        if (isMeterCategory(it) && action.payload.meter_qty != null) {
          const packQty = Number(it.pack_qty || 0)
          const baseMeter = Number(it.meter_qty ?? (Number(it.qty || 0) * packQty))
          const newMeter = Math.max(0, baseMeter - Number(action.payload.meter_qty))
          const newQty = packQty > 0 ? Math.ceil(newMeter / packQty) : Math.max(0, Number(it.qty || 0) - Number(action.payload.qty || 0))
          return { ...it, meter_qty: newMeter, qty: newQty }
        }
        return { ...it, qty: Number(it.qty) - Number(action.payload.qty) }
      })
      const filteredWh = soldWh
      const nextLogs = action.log ? [...state.logs, action.log] : state.logs
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
        return { ...state, warehouse: filteredWh, logs: nextLogs, accounts: nextAccounts }
      } catch (_err) {
        void _err
        return { ...state, warehouse: filteredWh, logs: nextLogs }
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
  const { user, authUser, session, username, hasPermission } = useAuth()
  const { notify } = useNotification()
  const [hydrated, setHydrated] = React.useState(false)
  const [isOnline, setIsOnline] = React.useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [connectionInfo, setConnectionInfo] = React.useState(getConnectionInfo())
  const slowConnectionRef = useRef(isSlowConnection())
  const pendingOpsRef = useRef([])
  const mountedRef = useRef(true)
  const normalizeProductList = React.useCallback((list) => {
    const normalizedList = []
    const updates = []
    ;(Array.isArray(list) ? list : []).forEach((item) => {
      const normalizedItem = normalizeProductCategoryRecord(item)
      if (normalizedItem !== item && item?.id) {
        updates.push({ id: item.id, category: normalizedItem.category })
      }
      normalizedList.push(normalizedItem)
    })
    return { normalizedList, updates }
  }, [])

  // Only attempt Supabase sync when we have auth + config
  const canSyncNow = React.useCallback(() => {
    // Require Supabase config + an authenticated session to avoid RLS/network spam when logged out
    return isSupabaseConfigured() && !!authUser && !!session
  }, [authUser, session])

  React.useEffect(() => {
    const updateNet = () => {
      const info = getConnectionInfo()
      slowConnectionRef.current = info.slow
      setConnectionInfo(info)
      setIsOnline(!info.offline)
    }
    updateNet()
    if (typeof window === 'undefined') return
    const conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection
    window.addEventListener('online', updateNet)
    window.addEventListener('offline', updateNet)
    if (conn?.addEventListener) conn.addEventListener('change', updateNet)
    return () => {
      window.removeEventListener('online', updateNet)
      window.removeEventListener('offline', updateNet)
      if (conn?.removeEventListener) conn.removeEventListener('change', updateNet)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]')
      if (Array.isArray(saved)) pendingOpsRef.current = saved
    } catch (_err) {
      void _err
    }
  }, [])
  
  const refreshData = React.useCallback(async (updateHydration = false) => {
    if (!username) {
      if (mountedRef.current && updateHydration) setHydrated(false)
      dispatch({ type: 'RESET_STATE' })
      return
    }
    try {
      const fetchLimit = safeLimit(120, 20)
      const logsLimit = safeLimit(60, 20)
      const [credits, warehouse, store, logs, clients, userBalances] = await Promise.all([
        getCredits({ limit: fetchLimit }),
        getProducts('warehouse', { limit: fetchLimit }),
        getProducts('store', { limit: fetchLimit }),
        getLogs(null, null, { limit: logsLimit }),
        getClients({ limit: fetchLimit }),
        getAllUserBalances(),
      ]);

      if (!mountedRef.current) return;

      const warehouseData = Array.isArray(warehouse) ? warehouse : warehouse?.data || []
      const storeData = Array.isArray(store) ? store : store?.data || []

      const normalizedWarehouse = normalizeProductList(warehouseData)
      const normalizedStore = normalizeProductList(storeData)

      dispatch({ type: 'SET_CREDITS', payload: Array.isArray(credits) ? credits : credits?.data || [] });
      dispatch({ type: 'SET_WAREHOUSE', payload: normalizedWarehouse.normalizedList });
      dispatch({ type: 'SET_STORE', payload: normalizedStore.normalizedList });
      dispatch({ type: 'SET_LOGS', payload: Array.isArray(logs) ? logs : logs?.data || [] });
      dispatch({ type: 'SET_CLIENTS', payload: Array.isArray(clients) ? clients : clients?.data || [] });

      if (userBalances?.length) {
        console.log('[AppContext] Loaded user accounts:', userBalances);
        dispatch({ type: 'SET_ACCOUNTS', payload: userBalances });
      }

      const categoryUpgrades = [...normalizedWarehouse.updates, ...normalizedStore.updates]
      if (categoryUpgrades.length) {
        const unique = new Map()
        categoryUpgrades.forEach(({ id, category }) => {
          if (id && category) unique.set(id, category)
        })
        const jobs = Array.from(unique.entries()).map(([id, category]) =>
          dbUpdateProduct(id, { category }).catch((err) => console.error('Product category migrate failed', id, err))
        )
        Promise.allSettled(jobs).catch(() => null)
      }
    } catch (_err) {
      console.error('AppContext: failed to load shared data', _err);
    }

    if (mountedRef.current && updateHydration) setHydrated(true);
  }, [username, dispatch, normalizeProductList]);

  React.useEffect(() => {
    mountedRef.current = true;
    refreshData(true);
    return () => {
      mountedRef.current = false;
    };
  }, [refreshData]);

  React.useEffect(() => {
    if (!username || !supabase?.channel) return undefined;
    const channel = supabase
      .channel('realtime-sales-nasiya')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => refreshData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nasiya' }, () => refreshData(false))
      .subscribe();

    return () => {
      try { channel?.unsubscribe?.() } catch (_err) { void _err }
    }
  }, [username, refreshData]);

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
  const persistPendingOps = React.useCallback(() => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pendingOpsRef.current))
    } catch (_err) {
      void _err
    }
  }, [])

  const queueOp = React.useCallback((op) => {
    if (!op || !op.type) {
      console.warn('[AppContext] queueOp: invalid op skipped', op)
      return
    }
    pendingOpsRef.current = [...pendingOpsRef.current, op]
    persistPendingOps()
  }, [persistPendingOps])

  const runSyncAction = React.useCallback(async (op) => {
    if (!op || !op.type) {
      console.warn('[AppContext] runSyncAction: invalid op', op)
      return
    }
    switch (op.type) {
      case 'insertProduct': {
        const saved = await dbInsertProduct(op.payload)
        if (op.log) insertLog(op.log).catch(() => null)
        const updates = saved || op.payload
        const actionType = (op.payload.location || '').toLowerCase() === 'store' ? 'EDIT_STORE' : 'EDIT_WAREHOUSE'
        dispatch({ type: actionType, payload: { id: op.payload.id, updates }, log: op.log || null })
        return
      }
      case 'updateProduct': {
        const saved = await dbUpdateProduct(op.payload.id, op.payload.updates)
        if (op.log) insertLog(op.log).catch(() => null)
        const actionType = (op.payload.location || '').toLowerCase() === 'store' ? 'EDIT_STORE' : 'EDIT_WAREHOUSE'
        dispatch({ type: actionType, payload: { id: op.payload.id, updates: saved || op.payload.updates }, log: op.log || null })
        return
      }
      case 'deleteProduct': {
        await dbDeleteProduct(op.payload.id)
        if (op.log) insertLog(op.log).catch(() => null)
        return
      }
      case 'insertCredit': {
        const saved = await dbInsertCredit(op.payload)
        if (op.log) {
          try { await insertCreditLog(op.log) } catch { await insertLog(op.log).catch(() => null) }
        }
        dispatch({ type: 'EDIT_CREDIT', payload: { id: saved?.id || op.payload.id, updates: saved || op.payload }, log: op.log || null })
        return
      }
      case 'updateCredit': {
        const saved = await dbUpdateCredit(op.payload.id, op.payload.updates)
        dispatch({ type: 'EDIT_CREDIT', payload: { id: op.payload.id, updates: saved || op.payload.updates }, log: op.log || null })
        return
      }
      case 'deleteCredit': {
        await dbDeleteCredit(op.payload.id)
        return
      }
      case 'insertClient': {
        const saved = await dbInsertClient(op.payload)
        dispatch({ type: 'ADD_CLIENT', payload: saved || op.payload, log: op.log || null })
        return
      }
      case 'updateClient': {
        const saved = await dbUpdateClient(op.payload.id, op.payload.updates)
        dispatch({ type: 'EDIT_CLIENT', payload: { id: op.payload.id, updates: saved || op.payload.updates }, log: op.log || null })
        return
      }
      case 'deleteClient': {
        await dbDeleteClient(op.payload.id)
        return
      }
      case 'insertLog': {
        if (op.log) await insertLog(op.log)
        return
      }
      case 'sellStore': {
        const { productId, updates, logPayload, username: saleUser, totalUzs, totalUsd } = op.payload || {}
        if (logPayload) insertLog(logPayload).catch(() => null)
        if (productId && updates) await dbUpdateProduct(productId, updates)
        if (saleUser && typeof totalUzs === 'number') {
          updateAccountBalance(saleUser, totalUzs, totalUsd || 0).catch(() => null)
          updateDailySales(saleUser, totalUzs, totalUsd || 0).catch(() => null)
        }
        return
      }
      default:
        return
    }
  }, [dispatch, dbInsertProduct, dbUpdateProduct, dbDeleteProduct, dbInsertCredit, dbUpdateCredit, dbDeleteCredit, dbInsertClient, dbUpdateClient, dbDeleteClient])

  const flushPendingOps = React.useCallback(async () => {
    if (!isOnline || !canSyncNow()) return
    if (!pendingOpsRef.current.length) return
    setSyncState('syncing')
    const queueCopy = [...pendingOpsRef.current]
    for (let i = 0; i < queueCopy.length; i += 1) {
      const op = pendingOpsRef.current[0]
      if (!op || !op.type) {
        console.warn('[AppContext] flushPendingOps: dropping invalid op', op)
        pendingOpsRef.current.shift()
        persistPendingOps()
        continue
      }
      try {
        await runSyncAction(op)
        pendingOpsRef.current.shift()
        persistPendingOps()
      } catch (err) {
        console.error('[AppContext] sync failed for op', op?.type, err)
        notify('Sync failed', err?.message || 'Pending action will retry when connection improves', 'warning')
        break
      }
    }
    setSyncState('idle')
  }, [isOnline, runSyncAction, notify, persistPendingOps, canSyncNow])

  React.useEffect(() => {
    flushPendingOps()
  }, [flushPendingOps])
  
  const syncOrQueue = React.useCallback((op, rollback) => {
    if (!op || !op.type) {
      console.warn('[AppContext] syncOrQueue: invalid op skipped', op)
      return
    }
    try {
      const ready = isOnline && !slowConnectionRef.current && canSyncNow()
      if (ready) {
        const promise = runSyncAction(op)
        if (promise?.catch) {
          promise.catch(err => {
            console.error('[AppContext] syncOrQueue failed', err)
            if (rollback) rollback()
            queueOp(op)
            notify('Sync queued', err?.message || 'Will retry when online', 'warning')
          })
        }
      } else {
        queueOp(op)
      }
    } catch (err) {
      console.error('[AppContext] syncOrQueue threw synchronously', err)
      if (rollback) rollback()
      queueOp(op)
      notify('Sync queued', err?.message || 'Will retry when online', 'warning')
    }
  }, [isOnline, runSyncAction, queueOp, notify, canSyncNow])
  
  // Action creators with DB persistence
  const addWarehouseProduct = React.useCallback(async (payload, logData) => {
    const log = logData ? { id: logData.id || uuidv4(), ...logData } : null
    const productId = payload.id || uuidv4()
    const optimisticProduct = { ...payload, id: productId, location: 'warehouse' }
    dispatch({ type: 'ADD_WAREHOUSE', payload: optimisticProduct, log })
    syncOrQueue({ type: 'insertProduct', payload: optimisticProduct, log })
    return optimisticProduct
  }, [dispatch, syncOrQueue])

  const addStoreProduct = React.useCallback(async (payload, logData) => {
    const log = logData ? { id: logData.id || uuidv4(), ...logData } : null
    const productId = payload.id || uuidv4()
    const optimisticProduct = { ...payload, id: productId, location: 'store' }
    dispatch({ type: 'ADD_STORE', payload: optimisticProduct, log })
    syncOrQueue({ type: 'insertProduct', payload: optimisticProduct, log })
    return optimisticProduct
  }, [dispatch, syncOrQueue])

  const updateWarehouseProduct = React.useCallback(async (id, updates, logData) => {
    const previous = (state.warehouse || []).find(w => w.id === id)
    const log = logData ? { id: logData.id || uuidv4(), ...logData } : null
    const merged = previous ? { ...previous, ...updates } : updates
    dispatch({ type: 'EDIT_WAREHOUSE', payload: { id, updates: merged }, log })
    syncOrQueue(
      { type: 'updateProduct', payload: { id, updates, location: 'warehouse' }, log },
      () => previous && dispatch({ type: 'EDIT_WAREHOUSE', payload: { id, updates: previous } })
    )
  }, [dispatch, state.warehouse, syncOrQueue])

  const updateStoreProduct = React.useCallback(async (id, updates, logData) => {
    const previous = (state.store || []).find(w => w.id === id)
    const log = logData ? { id: logData.id || uuidv4(), ...logData } : null
    const merged = previous ? { ...previous, ...updates } : updates
    dispatch({ type: 'EDIT_STORE', payload: { id, updates: merged }, log })
    syncOrQueue(
      { type: 'updateProduct', payload: { id, updates, location: 'store' }, log },
      () => previous && dispatch({ type: 'EDIT_STORE', payload: { id, updates: previous } })
    )
  }, [dispatch, state.store, syncOrQueue])

  const deleteWarehouseProduct = React.useCallback(async (id, logData) => {
    const previous = (state.warehouse || []).find(w => w.id === id)
    const log = logData ? { id: logData.id || uuidv4(), ...logData } : null
    dispatch({ type: 'DELETE_WAREHOUSE', payload: { id }, log })
    syncOrQueue(
      { type: 'deleteProduct', payload: { id, location: 'warehouse' }, log },
      () => previous && dispatch({ type: 'ADD_WAREHOUSE', payload: previous })
    )
  }, [dispatch, state.warehouse, syncOrQueue])

  const deleteStoreProduct = React.useCallback(async (id, logData) => {
    const previous = (state.store || []).find(w => w.id === id)
    const log = logData ? { id: logData.id || uuidv4(), ...logData } : null
    dispatch({ type: 'DELETE_STORE', payload: { id }, log })
    syncOrQueue(
      { type: 'deleteProduct', payload: { id, location: 'store' }, log },
      () => previous && dispatch({ type: 'ADD_STORE', payload: previous })
    )
  }, [dispatch, state.store, syncOrQueue])

  const moveWarehouseToStore = React.useCallback(async (payload, logData) => {
    try {
      const source = (state.warehouse || []).find((w) => w.id === payload.id)
      if (!source) throw new Error("Ombordagi mahsulot topilmadi")

      const inputItem = payload.item || source
      const isMeter = isMeterCategory(inputItem)
      const packQty = Number(payload.pack_qty ?? inputItem.pack_qty ?? source.pack_qty ?? 0)
      const meterDelta = isMeter ? Number(payload.meter_qty ?? payload.meter ?? 0) : 0
      const moveQty = isMeter
        ? Number(payload.qty || (packQty > 0 ? Math.ceil(meterDelta / Math.max(1, packQty)) : 0))
        : Number(payload.qty || 0)

      const baseSourceMeter = isMeter ? Number(source.meter_qty ?? (Number(source.qty || 0) * packQty)) : 0
      const nextSourceMeter = isMeter ? Math.max(0, baseSourceMeter - meterDelta) : null
      const nextSourceQty = isMeter
        ? (packQty > 0 ? Math.ceil(nextSourceMeter / Math.max(1, packQty)) : Math.max(0, Number(source.qty || 0) - moveQty))
        : Math.max(0, Number(source.qty || 0) - moveQty)

      const existingStore = (state.store || []).find((s) => {
        const sameName = (s.name || '').toLowerCase().trim() === (inputItem.name || '').toLowerCase().trim()
        const sameThickness = (s.stone_thickness || '') === (inputItem.stone_thickness || '')
        const sameSize = (s.stone_size || '') === (inputItem.stone_size || '')
        return sameName && sameThickness && sameSize
      })
      const storeId = existingStore?.id || uuidv4()

      const baseStoreMeter = isMeter ? Number(existingStore?.meter_qty ?? (Number(existingStore?.qty || 0) * packQty)) : 0
      const nextStoreMeter = isMeter ? baseStoreMeter + meterDelta : null
      const nextStoreQty = isMeter
        ? (packQty > 0 ? Math.ceil(nextStoreMeter / Math.max(1, packQty)) : Number(existingStore?.qty || 0) + moveQty)
        : Number(existingStore?.qty || 0) + moveQty

      const currency = inputItem.currency || existingStore?.currency || source.currency || 'UZS'
      const storePayload = {
        ...(existingStore || {}),
        ...inputItem,
        id: storeId,
        qty: nextStoreQty,
        pack_qty: packQty,
        currency,
        location: 'store',
      }
      if (isMeter) storePayload.meter_qty = nextStoreMeter
      else storePayload.meter_qty = null
      if (inputItem.price !== undefined) storePayload.price = inputItem.price
      if (inputItem.price_piece !== undefined) storePayload.price_piece = inputItem.price_piece
      if (inputItem.price_pack !== undefined) storePayload.price_pack = inputItem.price_pack

      const warehouseUpdates = isMeter ? { qty: nextSourceQty, meter_qty: nextSourceMeter } : { qty: nextSourceQty }
      const log = logData ? { id: logData.id || uuidv4(), ...logData } : null

      // Optimistic UI update
      dispatch({
        type: 'MOVE_TO_STORE',
        payload: {
          ...payload,
          id: source.id,
          qty: moveQty,
          meter_qty: meterDelta,
          pack_qty: packQty,
          item: { ...inputItem, id: storeId, pack_qty: packQty, location: 'store' },
        },
        log,
      })

      // Persist warehouse deduction
      syncOrQueue({ type: 'updateProduct', payload: { id: source.id, updates: warehouseUpdates, location: 'warehouse' }, log: null })

      // Persist / upsert store
      if (existingStore) {
        const updates = {
          qty: nextStoreQty,
          pack_qty: packQty,
          currency,
          location: 'store',
        }
        if (isMeter) updates.meter_qty = nextStoreMeter
        if (storePayload.price !== undefined) updates.price = storePayload.price
        if (storePayload.price_piece !== undefined) updates.price_piece = storePayload.price_piece
        if (storePayload.price_pack !== undefined) updates.price_pack = storePayload.price_pack
        if (storePayload.category) updates.category = storePayload.category
        if (storePayload.note !== undefined) updates.note = storePayload.note
        if (storePayload.date) updates.date = storePayload.date
        if (storePayload.electrode_size !== undefined) updates.electrode_size = storePayload.electrode_size
        if (storePayload.stone_thickness !== undefined) updates.stone_thickness = storePayload.stone_thickness
        if (storePayload.stone_size !== undefined) updates.stone_size = storePayload.stone_size

        syncOrQueue({ type: 'updateProduct', payload: { id: storeId, updates, location: 'store' }, log: null })
      } else {
        syncOrQueue({ type: 'insertProduct', payload: storePayload, log: null })
      }

      if (log) syncOrQueue({ type: 'insertLog', log })

      return { warehouseQty: nextSourceQty, storeQty: nextStoreQty }
    } catch (err) {
      const message = `Failed to move product: ${err.message}`
      notify('Error', message, 'error')
      throw err
    }
  }, [state.warehouse, state.store, dispatch, notify, syncOrQueue])

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
      const creditWithDirection = (() => {
        if (!credit) return { ...payload }
        if (!credit.credit_direction && payload.credit_direction) {
          return { ...credit, credit_direction: payload.credit_direction }
        }
        return credit
      })()

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
        credit_direction: logData?.credit_direction ?? payload.credit_direction ?? payload.type ?? null,
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
      dispatch({ type: 'ADD_CREDIT', payload: creditWithDirection, log: finalLog })
      return creditWithDirection
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
        const isMeter = isMeterCategory(p)
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
        const isMeter = isMeterCategory(p)
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
    moveWarehouseToStore,
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
  }), [state, dispatch, syncState, addWarehouseProduct, addStoreProduct, moveWarehouseToStore, updateWarehouseProduct, updateStoreProduct, deleteWarehouseProduct, deleteStoreProduct, sellStoreProduct, addCredit, updateCredit, deleteCredit, addClient, updateClient, deleteClient])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
export { AppContext }
