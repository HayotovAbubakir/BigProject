import { useEffect, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'

export default function useExchangeRate() {
  const { state } = useApp()
  const [rate, setRate] = useState(state?.exchangeRate || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const exchangeRate = state?.exchangeRate

  const fetchRate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=UZS')
      if (!res.ok) throw new Error('Network error')
      const data = await res.json()
      const r = data && data.rates && data.rates.UZS ? Number(data.rates.UZS) : null
      if (r) {
        setRate(r)
      } else {
        throw new Error('No rate')
      }
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // If a manual exchange rate exists in app state prefer that and skip network fetch
    if (exchangeRate) {
      setRate(exchangeRate)
      return
    }
    // otherwise fetch fresh rate (no localStorage caching)
    // Only re-run when the explicit exchangeRate value changes, not the whole state object.
    fetchRate()
  }, [fetchRate, exchangeRate])

  const refresh = useCallback(() => {
    fetchRate()
  }, [fetchRate])

  return { rate, loading, error, refresh }
}
