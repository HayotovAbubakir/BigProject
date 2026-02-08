import React, { useState, useEffect } from 'react'
import { TextField, InputAdornment } from '@mui/material'
import { parseNumber } from '../utils/format'

/**
 * FixedCurrencyField - Currency input with consistent comma formatting
 * 
 * FIXES:
 * - Dots appearing instead of commas while typing
 * - Inconsistent formatting between focus and blur
 * - Cursor position issues when currency symbol is displayed
 * 
 * HOW IT WORKS:
 * - Uses explicit comma formatting (not Intl.NumberFormat)
 * - Consistent formatting throughout typing and blur
 * - Currency symbols ($ for USD, UZS for UZS)
 * - Sends raw numeric value via onChange
 * 
 * @param {number|string} value - Current numeric value
 * @param {function} onChange - Callback with raw numeric value
 * @param {string} currency - Currency code (USD, UZS)
 * @param {string} label - TextField label
 * @param {...props} rest - Additional TextField props
 * 
 * @example
 * <FixedCurrencyField
 *   label="Amount"
 *   value={amount}
 *   onChange={setAmount}
 *   currency="USD"
 *   fullWidth
 * />
 */
export default function FixedCurrencyField({
  value = '',
  onChange,
  currency = 'UZS',
  label,
  fullWidth = true,
  variant = 'outlined',
  size = 'medium',
  onBlur,
  onFocus,
  disabled = false,
  error = false,
  helperText = '',
  ...rest
}) {
  const [display, setDisplay] = useState('')

  // Initialize display on mount or value change
  useEffect(() => {
    const num = parseNumber(value)
    const formatted = formatNumberExplicit(num)
    setDisplay(formatted)
  }, [value])

  /**
   * Explicitly format number with comma thousands separator
   * Avoids all locale-related issues
   */
  function formatNumberExplicit(num) {
    if (num === null || num === undefined || num === '' || num === 0) return ''

    const numStr = String(num)
    const parts = numStr.split('.')
    const intPart = parts[0]
    const decPart = parts[1]

    // Add commas to integer part
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    return decPart ? `${withCommas}.${decPart}` : withCommas
  }

  /**
   * Get currency symbol based on currency code
   */
  function getCurrencySymbol() {
    const curr = (currency || 'UZS').toUpperCase()
    if (curr === 'USD') return '$'
    return ''
  }

  /**
   * Handle input change with explicit formatting
   */
  const handleChange = (e) => {
    const raw = e.target.value

    // Remove all non-numeric characters except dot
    let cleaned = raw.replace(/[^\d.]/g, '')

    // Prevent multiple dots
    const dotCount = (cleaned.match(/\./g) || []).length
    if (dotCount > 1) {
      const lastDotIndex = cleaned.lastIndexOf('.')
      cleaned = cleaned.substring(0, lastDotIndex) + cleaned.substring(lastDotIndex + 1).replace(/\./g, '')
    }

    // If empty, clear
    if (!cleaned || cleaned === '.') {
      setDisplay('')
      onChange(null)
      return
    }

    // Parse and format
    const num = parseNumber(cleaned)
    const formatted = formatNumberExplicit(num)

    setDisplay(formatted)
    onChange(num)
  }

  /**
   * Handle blur - finalize formatting
   */
  const handleBlur = (e) => {
    const num = parseNumber(display)
    const formatted = formatNumberExplicit(num)
    setDisplay(formatted)
    onChange(num)
    if (onBlur) onBlur(e)
  }

  /**
   * Handle focus
   */
  const handleFocus = (e) => {
    if (onFocus) onFocus(e)
  }

  /**
   * Prevent mouse wheel from changing value
   */
  const handleWheel = (e) => {
    e.preventDefault()
    e.target.blur()
  }

  const symbol = getCurrencySymbol()
  const suffix = currency === 'USD' ? '' : ' UZS'

  return (
    <TextField
      label={label}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onWheel={handleWheel}
      fullWidth={fullWidth}
      variant={variant}
      size={size}
      disabled={disabled}
      error={error}
      helperText={helperText}
      inputProps={{
        inputMode: 'decimal',
        pattern: '[0-9.,]*',
        autoComplete: 'off',
      }}
      InputProps={{
        startAdornment: symbol ? <InputAdornment position="start">{symbol}</InputAdornment> : undefined,
        endAdornment: suffix ? <InputAdornment position="end">{suffix}</InputAdornment> : undefined,
      }}
      {...rest}
    />
  )
}
