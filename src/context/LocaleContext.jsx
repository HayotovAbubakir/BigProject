
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'
import en from '../i18n/en.json'
import uz from '../i18n/uz.json'

const SUPPORTED = ['uz', 'en']

const LocaleContext = createContext({ t: (k) => k, locale: 'uz', setLocale: () => {} })

export function LocaleProvider({ children }) {
  const getInitial = () => {
    try {
      const saved = localStorage.getItem('locale')
      if (saved && SUPPORTED.includes(saved)) return saved
    } catch (e) {
      // ignore
    }
    return 'uz'
  }

  const [locale, setLocaleState] = useState(getInitial)
  const dict = useMemo(() => (locale === 'uz' ? uz : en), [locale])

  const setLocale = useCallback((next) => {
    const normalized = next === 'en' ? 'en' : 'uz'
    if (!SUPPORTED.includes(normalized)) return
    try {
      localStorage.setItem('locale', normalized)
    } catch (e) {
      // ignore storage errors
    }
    setLocaleState(normalized)
  }, [])

  const t = useCallback((key, vars) => {
    let val = dict[key]
    if (typeof val === 'undefined') {
      // return empty string for missing keys to avoid mixed languages
      return ''
    }
    if (vars && typeof val === 'string') {
      Object.keys(vars).forEach(k => { val = val.replace(`{${k}}`, vars[k]) })
    }
    return val
  }, [dict])

  return (
    <LocaleContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export const useLocale = () => useContext(LocaleContext)

export default LocaleContext
