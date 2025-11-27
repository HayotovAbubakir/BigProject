import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

export default function useManualRate() {
  const { state, dispatch } = useApp()
  const [rate, setRate] = useState(null)

  useEffect(() => {
    
    if (state && state.exchangeRate) setRate(Number(state.exchangeRate))
    else setRate(null)
  }, [state && state.exchangeRate])

  const save = useCallback((r) => {
    const n = Number(r)
    setRate(n)
    dispatch({ type: 'SET_EXCHANGE_RATE', payload: n })
  }, [dispatch])

  const clear = useCallback(() => {
    setRate(null)
    dispatch({ type: 'SET_EXCHANGE_RATE', payload: null })
  }, [dispatch])

  return { rate, save, clear }
}
