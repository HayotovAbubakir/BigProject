import { useCallback } from 'react'
import { useApp } from '../context/AppContext'
import useExchangeRate from './useExchangeRate'

export default function useDisplayCurrency() {
  const { state, dispatch } = useApp()
  const { rate: usdToUzs } = useExchangeRate()
  const displayCurrency = state?.ui?.displayCurrency || 'UZS'

  const setDisplayCurrency = useCallback((c) => {
    dispatch({ type: 'SET_UI', payload: { displayCurrency: c } })
  }, [dispatch])

  
  
  const formatForDisplay = useCallback((amount, fromCurrency) => {
    const n = Number(amount || 0)
    const from = (fromCurrency || 'UZS')
    const to = displayCurrency || 'UZS'
    if (from === to) return n
    
    if (from === 'USD' && to === 'UZS') {
      if (usdToUzs) return Math.round(n * usdToUzs)
      
      return Math.round(n)
    }
    if (from === 'UZS' && to === 'USD') {
      if (usdToUzs && usdToUzs > 0) return Number((n / usdToUzs).toFixed(2))
      return Number((n).toFixed(2))
    }
    return n
  }, [displayCurrency, usdToUzs])

  return { displayCurrency, setDisplayCurrency, formatForDisplay }
}
