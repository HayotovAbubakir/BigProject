import React, { useState, useEffect } from 'react'
import { TextField, InputAdornment } from '@mui/material'
import { parseNumber, formatMoney } from '../utils/format'

/**
 * CurrencyField - A reusable currency input component
 * 
 * Features:
 * - Thousand separators while typing
 * - Preserves formatting on blur
 * - Provides clean numeric value for backend
 * - Disables mouse wheel increment/decrement
 * - Supports currency symbols (USD, UZS)
 * 
 * @param {number} value - The numeric value
 * @param {function} onChange - Callback with clean numeric value
 * @param {string} currency - Currency code (USD, UZS) for display
 * @param {string} label - Field label
 * @param {boolean} fullWidth - Full width flag
 * @param {object} rest - Additional Material-UI TextField props
 * 
 * @example
 * <CurrencyField 
 *   value={amount} 
 *   onChange={(val) => setAmount(val)}
 *   currency="UZS"
 *   label="Amount"
 * />
 */
export default function CurrencyField({ 
  value, 
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
  const [display, setDisplay] = useState(value == null || value === '' ? '' : formatMoney(value))

  useEffect(() => {
    if (value === parseNumber(display)) {
      return;
    }
    const next = value == null || value === '' ? '' : formatMoney(value)
    setDisplay(next)
  }, [value, display])

  /**
   * Format string with thousands separators while typing.
   * Keeps decimal part user typed (no rounding) and preserves trailing separator.
   * Uses explicit comma formatting to avoid locale issues.
   */
  const formatLive = (raw) => {
    if (!raw) return ''
    
    // Remove all non-numeric characters except dot
    const cleaned = raw.replace(/[^\d.]/g, '')
    if (!cleaned || cleaned === '.') return ''

    // Split by dot to separate integer and decimal parts
    const parts = cleaned.split('.')
    const intPart = parts[0]
    const decPart = parts[1]

    // Format integer part with commas
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    // Reconstruct with decimal part if present
    if (decPart !== undefined) {
      // If user just typed a dot, keep trailing dot
      if (raw.endsWith('.')) {
        return `${intFormatted}.`
      }
      return `${intFormatted}.${decPart}`
    }

    return intFormatted
  }

  /**
   * Handle input change with live grouping
   */
  const handleChange = (e) => {
    const raw = e.target.value
    const formatted = formatLive(raw)
    setDisplay(formatted)
    if (onChange) {
      onChange(formatted ? parseNumber(formatted) : null)
    }
  };

  /**
   * Prevent mouse wheel from changing numeric input value
   * This stops unwanted value changes when scrolling over the input
   */
  const handleWheel = (e) => {
    e.preventDefault()
    e.target.blur()
  }

  /**
   * Handle blur event - ensure formatting is final
   */
  const handleBlur = (e) => {
    const raw = e.target.value
    const num = parseNumber(raw)
    const formatted = num ? formatMoney(num) : ''
    setDisplay(formatted)
    if (onChange) onChange(formatted ? num : null)
    if (onBlur) onBlur(e)
  }

  /**
   * Handle focus event
   */
  const handleFocus = (e) => {
    if (onFocus) onFocus(e)
  }

  // Get currency symbol
  const getCurrencySymbol = () => {
    const curr = (currency || 'UZS').toUpperCase()
    if (curr === 'USD') return '$'
    if (curr === 'UZS') return ''
    return curr
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
        autoComplete: 'off'
      }}
      InputProps={{
        startAdornment: symbol ? <InputAdornment position="start">{symbol}</InputAdornment> : undefined,
        endAdornment: suffix ? <InputAdornment position="end">{suffix}</InputAdornment> : undefined,
      }}
      {...rest}
    />
  )
}
