import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/useApp';

const MANUAL_RATE_KEY = 'manualExchangeRate';

export default function useManualRate() {
  const { state, dispatch } = useApp();

  // Initialize state from localStorage or global state
  const [rate, setRate] = useState(() => {
    try {
      const storedRate = localStorage.getItem(MANUAL_RATE_KEY);
      if (storedRate) {
        const parsedRate = JSON.parse(storedRate);
        if (typeof parsedRate === 'number' && parsedRate > 0) {
          return parsedRate;
        }
      }
    } catch (error) {
      console.error("Failed to parse manual rate from localStorage", error);
    }
    return state?.exchangeRate || 12700;
  });

  // Load from localStorage on mount only (preserve manual rate across refresh)
  useEffect(() => {
    try {
      const storedRate = localStorage.getItem(MANUAL_RATE_KEY);
      if (storedRate) {
        const parsedRate = JSON.parse(storedRate);
        if (typeof parsedRate === 'number' && parsedRate > 0) {
          setRate(parsedRate);
          dispatch({ type: 'SET_EXCHANGE_RATE', payload: parsedRate });
        }
      }
    } catch (error) {
      console.error("Failed to load manual rate from localStorage on mount", error);
    }
  }, []);

  const save = useCallback((newRate) => {
    const n = Number(newRate);
    if (!isNaN(n) && n > 0) {
      try {
        localStorage.setItem(MANUAL_RATE_KEY, JSON.stringify(n));
        setRate(n);
        dispatch({ type: 'SET_EXCHANGE_RATE', payload: n });
      } catch (error) {
        console.error("Failed to save manual rate to localStorage", error);
      }
    }
  }, [dispatch]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(MANUAL_RATE_KEY);
      setRate(null);
      dispatch({ type: 'SET_EXCHANGE_RATE', payload: null });
    } catch (error) {
      console.error("Failed to clear manual rate from localStorage", error);
    }
  }, [dispatch]);

  return { rate, save, clear };
}

