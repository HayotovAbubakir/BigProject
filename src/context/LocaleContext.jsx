
import React, { createContext, useContext, useState, useMemo } from 'react'
import en from '../i18n/en.json'
import uz from '../i18n/uz.json'

const LocaleContext = createContext({ t: (k) => k, locale: 'uz', setLocale: () => {} })

export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState('uz')
  const dict = useMemo(() => (locale === 'uz' ? uz : en), [locale])
  const t = (key, vars) => {
    let val = dict[key] || key
    if (vars && typeof val === 'string') {
      Object.keys(vars).forEach(k => { val = val.replace(`{${k}}`, vars[k]) })
    }
    return val
  }
  return (
    <LocaleContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export const useLocale = () => useContext(LocaleContext)

export default LocaleContext
