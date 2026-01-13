import { useCallback } from 'react'
import { useApp } from '../context/useApp'
import { loadAppState, saveAppState } from '../firebase/db'
import { formatMoney } from '../utils/format'

export default function useDisplayCurrency() {
  const { state, dispatch } = useApp()
  const usdToUzs = state.exchangeRate
  const displayCurrency = state?.ui?.displayCurrency || 'UZS'

  const setDisplayCurrency = useCallback(async (c) => {
    dispatch({ type: 'SET_UI', payload: { displayCurrency: c } })
    try {
      const remote = (await loadAppState(null)) || {}
      remote.ui = { ...(remote.ui || {}), displayCurrency: c }
      await saveAppState(remote, null)
    } catch (e) {
      console.debug('Failed to save display currency to Supabase', e)
    }
  }, [dispatch])

  
  
  const formatForDisplay = useCallback((amount, fromCurrency) => {
    const n = Number(amount || 0)
    const from = (fromCurrency || 'UZS')
    const to = displayCurrency || 'UZS'
    let result
    if (from === to) {
      result = n
    } else if (from === 'USD' && to === 'UZS') {
      if (usdToUzs) result = Math.round(n * usdToUzs)
      else result = n
    } else if (from === 'UZS' && to === 'USD') {
      if (usdToUzs && usdToUzs > 0) result = Number((n / usdToUzs).toFixed(2))
      else result = n
    } else {
      result = n
    }
    return formatMoney(result)
  }, [displayCurrency, usdToUzs])

  return { displayCurrency, setDisplayCurrency, formatForDisplay }
}
