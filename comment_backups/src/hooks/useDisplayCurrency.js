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

  // amount: numeric value in its native currency (fromCurrency)
  // returns a numeric value in the selected display currency (or null if cannot compute)
  const formatForDisplay = useCallback((amount, fromCurrency) => {
    const n = Number(amount || 0)
    const from = (fromCurrency || 'UZS')
    const to = displayCurrency || 'UZS'
    if (from === to) return n
    // convert
    if (from === 'USD' && to === 'UZS') {
      if (usdToUzs) return Math.round(n * usdToUzs)
      // fallback: if amount already has _uzs counterpart not provided here, return n as-is
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
