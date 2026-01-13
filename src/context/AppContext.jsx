
import React, { createContext, useReducer, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { loadAppState, saveAppState } from '../firebase/db'
import { getClients, insertClient as dbInsertClient, updateClient as dbUpdateClient, deleteClient as dbDeleteClient } from '../firebase/supabaseClients'
import { getProducts, insertProduct as dbInsertProduct, updateProduct as dbUpdateProduct, deleteProduct as dbDeleteProduct } from '../firebase/supabaseInventory'
import { getCredits, insertCredit as dbInsertCredit, updateCredit as dbUpdateCredit, deleteCredit as dbDeleteCredit } from '../firebase/supabaseCredits'
import { getLogs, insertLog, insertCreditLog } from '../firebase/supabaseLogs'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from './NotificationContext';

const lowStockJokes = [
  "Looks like {name} is playing hide and seek. And it's winning.",
  "Warning: {name} is about to become a myth. Restock now!",
  "The shelf for {name} is looking a bit lonely. And empty.",
  "Our {name} stock is so low, it could be a snake's belly in a wagon rut.",
  "We're running out of {name} faster than I run out of good ideas. Help!"
];

const overdueCreditJokes = [
  "The credit for {name} is older than my last good joke. Please settle up!",
  "Yo, the credit for {name} is starting to grow cobwebs. Time to pay up!",
  "The nasiya for {name} is so old, it's about to be a historical artifact.",
  "I've seen glaciers move faster than this payment for {name}. Just saying.",
  "Alert: The credit for {name} is so overdue, it's starting to ferment."
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
    displayCurrency: 'UZS',
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
        payload.accounts = payload.accounts.filter(a => a.username !== 'shogirt')
      }
      return { ...state, ...payload }
    }
    case 'SET_EXCHANGE_RATE':
      return { ...state, exchangeRate: action.payload }
    case 'ADD_WAREHOUSE':
      return { ...state, warehouse: [...state.warehouse, action.payload], logs: [...state.logs, action.log] }
    case 'MOVE_TO_STORE': {
      
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
      
      const sold = state.store.map((it) => (it.id === action.payload.id ? { ...it, qty: Number(it.qty) - Number(action.payload.qty) } : it))
      const filteredStore = sold.filter(s => Number(s.qty) > 0)
      // update account balances (credit the selling account) when a sale happens
      try {
        const log = action.log || {}
        const uname = (log.user || '').toString().toLowerCase()
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
      
      const soldWh = state.warehouse.map((it) => (it.id === action.payload.id ? { ...it, qty: Number(it.qty) - Number(action.payload.qty) } : it))
      const filteredWh = soldWh.filter(w => Number(w.qty) > 0)
      // also credit the selling account (if present) for warehouse sales
      try {
        const log = action.log || {}
        const uname = (log.user || '').toString().toLowerCase()
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
        return { ...state, accounts: [...state.accounts, cleanPayload], logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${cleanPayload.username} added` }] }
      } catch (_ignore) {
        void _ignore
        return { ...state, accounts: [...state.accounts, action.payload], logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${action.payload.username} added` }] }
      }
    case 'ADD_CLIENT':
      try {
        const owner = (action.payload && (action.payload.owner || action.log && action.log.user) || 'shared').toString().toLowerCase()
        const cleanPayload = { ...action.payload, owner }
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
      if (uname === 'developer') return state // Prevent developer account from being edited
      if ((uname === 'hamdamjon' || uname === 'habibjon') && (action.payload.user || '').toString().toLowerCase() !== 'developer') return state
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
      if (uname === 'developer') return state // Prevent developer account from being deleted
      if ((uname === 'hamdamjon' || uname === 'habibjon') && (action.payload.user || '').toString().toLowerCase() !== 'developer') return state
      return { ...state, accounts: state.accounts.filter(a => (a.username || '').toString().toLowerCase() !== uname), logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${action.payload.username} deleted` }] }
    }
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
  
  React.useEffect(() => {
    mountedRef.current = true;
    const loadData = async () => {
      let remote = null;
      try {
        // Prefer user-specific saved state; fall back to shared
        remote = await loadAppState(username || null);
        if (!remote) remote = await loadAppState(null);
      } catch (err) {
        console.error('AppContext: loadAppState failed', err);
      }

      if (!mountedRef.current) return;

      if (remote) {
        const fixItem = (it) => {
          if (!it || (it.currency || 'UZS') !== 'USD') return it;
          const copy = { ...it };
          if (copy.price_uzs !== undefined && Number(copy.price_uzs) === Number(copy.price)) {
            delete copy.price_uzs;
          }
          if (copy.cost_uzs !== undefined && Number(copy.cost_uzs) === Number(copy.cost)) {
            delete copy.cost_uzs;
          }
          return copy;
        };

        try {
          if (remote.store && Array.isArray(remote.store)) remote.store = remote.store.map(fixItem);
          if (remote.warehouse && Array.isArray(remote.warehouse)) remote.warehouse = remote.warehouse.map(fixItem);
        } catch (e) {
          console.debug('AppContext: migration error', e);
        }

        try {
          dispatch({ type: 'INIT', payload: remote });
          console.log('AppContext: initialized from remote state');
        } catch (e) {
          console.error('AppContext: failed to init from remote', e);
        }
      } else {
        try {
          const [credits, warehouse, store, logs, clients] = await Promise.all([
            getCredits(),
            getProducts('warehouse'),
            getProducts('store'),
            getLogs(),
            getClients(),
          ]);

          if (!mountedRef.current) return;

          dispatch({ type: 'SET_CREDITS', payload: credits });
          console.log('AppContext: loaded shared credits');
          dispatch({ type: 'SET_WAREHOUSE', payload: warehouse });
          console.log('AppContext: loaded shared warehouse');
          dispatch({ type: 'SET_STORE', payload: store });
          console.log('AppContext: loaded shared store');
          dispatch({ type: 'SET_LOGS', payload: logs });
          console.log('AppContext: loaded shared logs');
          dispatch({ type: 'SET_CLIENTS', payload: clients });
          console.log('AppContext: loaded clients');

        } catch (_err) {
          console.error('AppContext: failed to load shared data', _err);
        }
      }

      if (mountedRef.current) setHydrated(true);
    };

    loadData();

    return () => {
      mountedRef.current = false;
    };
  }, [username]);

  const [syncState, setSyncState] = React.useState('idle')
  
  
  React.useEffect(() => {
    if (!hydrated) return

    setSyncState('pending')

    const t = setTimeout(() => {
      ;(async () => {
        try {
          // Save the entire app state snapshot shared
          const fullState = { ...state }
          const success = await saveAppState(fullState, username || null)

          setSyncState(success ? 'synced' : 'error')
          console.log('App state saved:', success ? 'Muvaffaqiyatli' : 'Xatolik')
        } catch (err) {
          console.error('AppContext: saveAppState xatosi:', err)
          setSyncState('error')
        }
      })()
    }, 800)

    return () => {
      clearTimeout(t)
      setSyncState('pending')
    }
  }, [hydrated, username, state])  

  
  // Action creators with DB persistence
  const addWarehouseProduct = React.useCallback(async (payload, logData) => {
    try {
      const product = await dbInsertProduct({ ...payload, location: 'warehouse' })
      let log = null
      try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (warehouse add), continuing', e) }
      dispatch({ type: 'ADD_WAREHOUSE', payload: product, log })
    } catch (_err) {
      const message = `Failed to add warehouse product: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify])

  const addStoreProduct = React.useCallback(async (payload, logData) => {
    try {
      const product = await dbInsertProduct({ ...payload, location: 'store' })
      let log = null
      try { log = await insertLog(logData) } catch (e) { console.warn('insertLog failed (store add), continuing', e) }
      dispatch({ type: 'ADD_STORE', payload: product, log })
    } catch (_err) {
      const message = `Failed to add store product: ${_err.message}`;
      notify('Error', message, 'error')
      throw _err
    }
  }, [dispatch, notify])

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

  const addCredit = React.useCallback(async (payload, logData) => {
    try {
      // ensure created_by and created_at for credits (site-wide)
      payload.created_by = payload.created_by || username || 'shared'
      payload.created_at = payload.created_at || Math.floor(Date.now() / 1000)
      const credit = await dbInsertCredit(payload)
      insertCreditLog(logData).catch(e => console.warn('insertCreditLog failed (add credit), continuing with local state update', e))
      dispatch({ type: 'ADD_CREDIT', payload: credit, log: logData })
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
      if (typeof hasPermission === 'function' && !hasPermission('credits_manage')) {
        const msg = 'Permission denied: credits manage required'
        notify && notify('Permission Denied', msg, 'error')
        throw new Error('permissionDenied')
      }
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
      if (typeof hasPermission === 'function' && !hasPermission('credits_manage')) {
        const msg = 'Permission denied: credits manage required'
        notify && notify('Permission Denied', msg, 'error')
        throw new Error('permissionDenied')
      }
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
        if (p && Number(p.qty || 0) <= 2) lowStockIds.push(p.id)
      })

      const overdueIds = []
      ;(state.credits || []).forEach(c => {
        if (!c) return
        const createdAt = c.created_at ? c.created_at * 1000 : 0
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

      // Low stock notifications (only new ones)
      ;[...(state.store || []), ...(state.warehouse || [])].forEach(p => {
        if (!p) return
        if (Number(p.qty || 0) <= 2 && !notifiedItems.current.has(p.id)) {
          const randomJoke = lowStockJokes[Math.floor(Math.random() * lowStockJokes.length)];
          notify('Low Stock!', randomJoke.replace('{name}', p.name), 'warning');
          notifiedItems.current.add(p.id);
        }
      })

      // Overdue credits notifications (only new ones)
      ;(state.credits || []).forEach(c => {
        if (!c) return
        const key = `credit:${c.id}`
        if (!c.completed && !notifiedItems.current.has(key)) {
          const createdAt = c.created_at ? c.created_at * 1000 : 0;
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
    addCredit,
    updateCredit,
    deleteCredit,
    addClient,
    updateClient,
    deleteClient
  }), [state, dispatch, syncState, addWarehouseProduct, addStoreProduct, updateWarehouseProduct, updateStoreProduct, deleteWarehouseProduct, deleteStoreProduct, addCredit, updateCredit, deleteCredit, addClient, updateClient, deleteClient])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
export { AppContext }
