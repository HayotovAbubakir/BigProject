/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useReducer, useContext } from 'react'
import { loadAppState, saveAppState } from '../utils/storage'
import { useAuth } from './AuthContext'

// Start with empty state by default. Data will be loaded from localStorage if present.
const initialState = {
  warehouse: [],
  store: [],
  logs: [],
  credits: [],
  exchangeRate: null, // USD -> UZS manual override
  // UI preferences and transient drafts are persisted as part of the app state
  ui: {
    dark: false,
    receiptRate: 13000,
    displayCurrency: 'UZS',
  },
  drafts: {},
  // account level permissions stored here; username keys stored lowercase
  accounts: [
    { username: 'hamdamjon', label: 'Hamdamjon', permissions: { credits_manage: true, wholesale_allowed: true, add_products: true, manage_accounts: true } },
    { username: 'habibjon', label: 'Habibjon', permissions: { credits_manage: true, wholesale_allowed: true, add_products: true, manage_accounts: true } },
    { username: 'shogirt', label: 'Shogirt', permissions: { credits_manage: false, wholesale_allowed: false, add_products: false, manage_accounts: false } },
  ],
}
// Firestore-backed single document will store the app state

const AppContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload }
    case 'ADD_WAREHOUSE':
      return { ...state, warehouse: [...state.warehouse, action.payload], logs: [...state.logs, action.log] }
    case 'MOVE_TO_STORE': {
      // decrease from warehouse and add to store (merge if exists). Remove warehouse item if qty <= 0
      const whUpdated = state.warehouse.map((it) => (it.id === action.payload.id ? { ...it, qty: Number(it.qty) - Number(action.payload.qty) } : it))
      // filter out items with non-positive qty
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
      // subtract sold qty and remove store items with qty <= 0
      const sold = state.store.map((it) => (it.id === action.payload.id ? { ...it, qty: Number(it.qty) - Number(action.payload.qty) } : it))
      const filteredStore = sold.filter(s => Number(s.qty) > 0)
      return { ...state, store: filteredStore, logs: [...state.logs, action.log] }
    }
    case 'SELL_WAREHOUSE': {
      // subtract sold qty from warehouse and remove entries with qty <= 0
      const soldWh = state.warehouse.map((it) => (it.id === action.payload.id ? { ...it, qty: Number(it.qty) - Number(action.payload.qty) } : it))
      const filteredWh = soldWh.filter(w => Number(w.qty) > 0)
      return { ...state, warehouse: filteredWh, logs: [...state.logs, action.log] }
    }
    case 'ADD_STORE':
      return { ...state, store: [...state.store, action.payload], logs: [...state.logs, action.log] }
    case 'DELETE_STORE':
      return { ...state, store: state.store.filter(s => s.id !== action.payload.id), logs: [...state.logs, action.log] }
    case 'ADD_CREDIT':
      return { ...state, credits: [...state.credits, action.payload], logs: [...state.logs, action.log] }
    case 'DELETE_WAREHOUSE':
      return { ...state, warehouse: state.warehouse.filter(w => w.id !== action.payload.id), logs: [...state.logs, action.log] }
    case 'EDIT_WAREHOUSE':
      return { ...state, warehouse: state.warehouse.map(w => w.id === action.payload.id ? { ...w, ...action.payload.updates } : w), logs: [...state.logs, action.log] }
    case 'ADJUST_WAREHOUSE_QTY':
      return { ...state, warehouse: state.warehouse.map(w => w.id === action.payload.id ? { ...w, qty: w.qty + action.payload.delta } : w), logs: [...state.logs, action.log] }
    case 'DELETE_CREDIT':
      return { ...state, credits: state.credits.filter(c => c.id !== action.payload.id), logs: [...state.logs, action.log] }
    case 'EDIT_CREDIT':
      return { ...state, credits: state.credits.map(c => c.id === action.payload.id ? { ...c, ...action.payload.updates } : c), logs: [...state.logs, action.log] }
    case 'SET_EXCHANGE_RATE':
      return { ...state, exchangeRate: action.payload }
    case 'ADD_ACCOUNT':
      return { ...state, accounts: [...state.accounts, action.payload], logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${action.payload.username} added` }] }
    case 'SET_UI':
      try {
        const nextUi = { ...state.ui, ...(action.payload || {}) }
        // Avoid needless updates if UI unchanged
        if (JSON.stringify(nextUi) === JSON.stringify(state.ui)) return state
        return { ...state, ui: nextUi }
      } catch {
        return { ...state, ui: { ...state.ui, ...(action.payload || {}) } }
      }
    case 'SET_DRAFT': {
      const { key, value } = action.payload || {}
      if (!key) return state
      try {
        const existing = (state.drafts || {})[key]
        if (JSON.stringify(existing) === JSON.stringify(value)) return state
      } catch {
        // ignore
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
      const uname = (action.payload.username || '').toLowerCase()
      // protect core admins from being modified
      if (uname === 'hamdamjon' || uname === 'habibjon') return state
      return { ...state, accounts: state.accounts.map(a => a.username === action.payload.username ? { ...a, ...action.payload.updates } : a), logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${action.payload.username} edited` }] }
    }
    case 'DELETE_ACCOUNT': {
      const uname = (action.payload.username || '').toLowerCase()
      // protect core admins from deletion
      if (uname === 'hamdamjon' || uname === 'habibjon') return state
      return { ...state, accounts: state.accounts.filter(a => a.username !== action.payload.username), logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${action.payload.username} deleted` }] }
    }
    default:
      return state
  }
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { user } = useAuth()
  // hydrated prevents the initial empty state from overwriting existing storage
  const [hydrated, setHydrated] = React.useState(false)
  const LOCAL_BACKUP_KEY = 'shop_state_backup_v1'

  // load initial state from Firestore on mount or when user changes
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const remote = await loadAppState(user?.username)
        if (!mounted) return
        if (remote) {
          // Migration: previous versions sometimes stored a _uzs copy equal to the USD numeric value
          const fixItem = (it) => {
            if (!it || (it.currency || 'UZS') !== 'USD') return it
            const copy = { ...it }
            if (copy.price_uzs !== undefined && Number(copy.price_uzs) === Number(copy.price)) {
              delete copy.price_uzs
            }
            if (copy.cost_uzs !== undefined && Number(copy.cost_uzs) === Number(copy.cost)) {
              delete copy.cost_uzs
            }
            return copy
          }
          try {
            if (remote.store && Array.isArray(remote.store)) remote.store = remote.store.map(fixItem)
            if (remote.warehouse && Array.isArray(remote.warehouse)) remote.warehouse = remote.warehouse.map(fixItem)
          } catch (e) {
            console.debug('AppContext: migration error', e)
          }
          dispatch({ type: 'INIT', payload: remote })
        }
      } catch (err) {
        console.warn('AppContext: loadAppState failed', err)
      } finally {
        if (mounted) setHydrated(true)
      }
    })()
    return () => { mounted = false }
  }, [user?.username])

  // Track sync state
  const [syncState, setSyncState] = React.useState('idle')
  
  // persist to localStorage whenever state changes, after hydration. Debounced to avoid rapid writes.
  React.useEffect(() => {
    if (!hydrated) return

    setSyncState('pending')

    const t = setTimeout(async () => {
      try {
        const success = await saveAppState(state, user?.username)
        setSyncState(success ? 'synced' : 'error')
        console.log('Saqlash natijasi:', success ? 'Muvaffaqiyatli' : 'Xatolik')
      } catch (err) {
        console.error('AppContext: saveAppState xatosi:', err)
        setSyncState('error')
      }
    }, 800)

    return () => {
      clearTimeout(t)
      setSyncState('pending')
    }
  }, [state, hydrated, user?.username])

  // Always keep a local backup in localStorage
  React.useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state))
      console.debug('AppContext: local backup saved (localStorage)')
    } catch (err) {
      console.warn('AppContext: local backup write failed', err)
    }
  }, [state, hydrated])

  const value = React.useMemo(() => ({ 
    state, 
    dispatch,
    syncState, // Add sync state to context
    isOnline: navigator.onLine
  }), [state, dispatch, syncState])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
