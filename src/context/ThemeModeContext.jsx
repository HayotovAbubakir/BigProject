import React from 'react'

export const ThemeModeContext = React.createContext(null)

export function useThemeMode() {
  const ctx = React.useContext(ThemeModeContext)
  if (!ctx) throw new Error('useThemeMode must be used inside ThemeModeProvider')
  return ctx
}
