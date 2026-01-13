import { useEffect, useState, useCallback } from 'react'
import { useApp } from '../context/useApp'

export default function useExchangeRate() {
  const { state, dispatch } = useApp()
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
        dispatch({ type: 'SET_EXCHANGE_RATE', payload: r })
      } else {
        throw new Error('No rate')
      }
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    
    if (exchangeRate) {
      setRate(exchangeRate)
      return
    }
    
    
    fetchRate()
  }, [fetchRate, exchangeRate])

  const refresh = useCallback(() => {
    fetchRate()
  }, [fetchRate])

  return { rate, loading, error, refresh }
}
