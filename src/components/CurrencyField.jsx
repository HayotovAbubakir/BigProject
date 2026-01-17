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
    const next = value == null || value === '' ? '' : formatMoney(value)
    setDisplay(next)
  }, [value])

  /**
   * Handle input change with smart cursor position preservation
   * Maintains cursor position relative to actual numeric content
   */
  const handleChange = (e) => {
    const input = e.target
    const oldDisplay = display
    const raw = input.value
    
    // Parse raw input to get numeric value
    const num = parseNumber(raw)
    const formatted = formatMoney(num)
    
    // Update display and call onChange callback
    setDisplay(formatted)
    if (onChange) onChange(num)
    
    // Restore cursor position in next render
    requestAnimationFrame(() => {
      const oldNumericLength = oldDisplay.replace(/[^\d]/g, '').length
      const newNumericLength = formatted.replace(/[^\d]/g, '').length
      const difference = newNumericLength - oldNumericLength
      
      // Calculate new cursor position based on numeric content growth
      let newCursorPos = input.selectionStart + difference
      if (newCursorPos < 0) newCursorPos = 0
      if (newCursorPos > formatted.length) newCursorPos = formatted.length
      
      input.setSelectionRange(newCursorPos, newCursorPos)
    })
  }

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
    const formatted = formatMoney(num)
    setDisplay(formatted)
    if (onChange) onChange(num)
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
        inputMode: 'numeric',
        pattern: '[0-9 .,]*',
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
