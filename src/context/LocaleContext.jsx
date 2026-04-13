
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'
import translations, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../i18n/translations'

const LocaleContext = createContext({ t: (k) => k, locale: DEFAULT_LANGUAGE, setLocale: () => {} })

export function LocaleProvider({ children }) {
  const getInitial = () => {
    try {
      const saved = localStorage.getItem('locale')
      if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved
    } catch (e) {
      // ignore
    }
    return DEFAULT_LANGUAGE
  }

  const [locale, setLocaleState] = useState(getInitial)
  const dict = useMemo(() => translations[locale] || translations[DEFAULT_LANGUAGE], [locale])
  const fallbackDict = translations.en || translations[DEFAULT_LANGUAGE]

  const setLocale = useCallback((next) => {
    const normalized = SUPPORTED_LANGUAGES.includes(next) ? next : DEFAULT_LANGUAGE
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
      val = fallbackDict?.[key]
    }
    if (typeof val === 'undefined') {
      return key
    }
    if (vars && typeof val === 'string') {
      Object.keys(vars).forEach(k => { val = val.replace(`{${k}}`, vars[k]) })
    }
    return val
  }, [dict, fallbackDict])

  return (
    <LocaleContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export const useLocale = () => useContext(LocaleContext)

export default LocaleContext
