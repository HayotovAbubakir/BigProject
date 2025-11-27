
import React, { createContext, useReducer, useContext } from 'react'
import { loadAppState, saveAppState } from '../utils/storage'
import { useAuth } from './AuthContext'


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
  
  accounts: [
    { username: 'hamdamjon', label: 'Hamdamjon', permissions: { credits_manage: true, wholesale_allowed: true, add_products: true, manage_accounts: true } },
    { username: 'habibjon', label: 'Habibjon', permissions: { credits_manage: true, wholesale_allowed: true, add_products: true, manage_accounts: true } },
    { username: 'shogirt', label: 'Shogirt', permissions: { credits_manage: false, wholesale_allowed: false, add_products: false, manage_accounts: false } },
  ],
}


const AppContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...state, ...action.payload }
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
      return { ...state, store: filteredStore, logs: [...state.logs, action.log] }
    }
    case 'SELL_WAREHOUSE': {
      
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
      
      if (uname === 'hamdamjon' || uname === 'habibjon') return state
      return { ...state, accounts: state.accounts.map(a => a.username === action.payload.username ? { ...a, ...action.payload.updates } : a), logs: [...state.logs, action.log || { ts: Date.now(), action: `Account ${action.payload.username} edited` }] }
    }
    case 'DELETE_LOGS_FOR_DATE': {
      try {
        const date = (action.payload && action.payload.date) || ''
        const user = (action.payload && action.payload.user) || 'unknown'
        const uname = (user || '').toString().toLowerCase()
        if (uname !== 'hamdamjon' && uname !== 'habibjon') return state
        const remaining = (state.logs || []).filter(l => (l.date || '').toString().slice(0, 10) !== date)
        return { ...state, logs: [...remaining, { ts: Date.now(), action: `Logs for ${date} deleted by ${user}` }] }
      } catch (err) {
        return state
      }
    }
    case 'DELETE_ACCOUNT': {
      const uname = (action.payload.username || '').toLowerCase()
      
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
  
  const [hydrated, setHydrated] = React.useState(false)
  const LOCAL_BACKUP_KEY = 'shop_state_backup_v1'

  
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const remote = await loadAppState(user?.username)
        if (!mounted) return
        if (remote) {
          
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

  
  const [syncState, setSyncState] = React.useState('idle')
  
  
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

  
  React.useEffect(() => {
    if (!hydrated) return
    try {
      // persistence is handled by SQL-backed storage via saveAppState
      // no localStorage writes are performed
    } catch (err) {
      console.warn('AppContext: local backup write failed', err)
    }
  }, [state, hydrated])

  const value = React.useMemo(() => ({ 
    state, 
    dispatch,
    syncState, 
    isOnline: navigator.onLine
  }), [state, dispatch, syncState])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
