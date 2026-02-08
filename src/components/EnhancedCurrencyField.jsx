import React from 'react'
import { TextField, InputAdornment } from '@mui/material'
import { useNumericInput } from '../hooks/useNumericInput'

/**
 * Enhanced CurrencyField component with improved cursor position management
 * 
 * Advanced currency input with live formatting and intelligent cursor preservation.
 * Supports multiple currencies (USD, UZS) with appropriate symbol display.
 * 
 * @param {number|string} value - Current numeric value
 * @param {function} onChange - Callback receiving raw numeric value
 * @param {string} currency - Currency code (USD, UZS)
 * @param {string} label - Field label
 * @param {boolean} fullWidth - Whether field takes full width
 * @param {string} variant - MUI TextField variant
 * @param {string} size - MUI TextField size
 * @param {function} onBlur - Optional blur handler
 * @param {function} onFocus - Optional focus handler
 * @param {boolean} disabled - Whether field is disabled
 * @param {boolean} error - Whether field has error
 * @param {string} helperText - Helper text below field
 * @param {...rest} rest - Additional TextField props
 * 
 * @example
 * <EnhancedCurrencyField
 *   value={amount}
 *   onChange={(val) => setAmount(val)}
 *   currency="USD"
 *   label="Price"
 *   fullWidth
 * />
 */
export default function EnhancedCurrencyField({
  value,
  onChange,
  currency = 'UZS',
  label,
  fullWidth = true,
  variant = 'outlined',
  size = 'medium',
  onBlur: externalOnBlur,
  onFocus: externalOnFocus,
  disabled = false,
  error = false,
  helperText = '',
  ...rest
}) {
  const {
    displayValue,
    handleChange,
    handleBlur: hookHandleBlur,
    handleFocus: hookHandleFocus,
    handleWheel,
    inputRef,
  } = useNumericInput(value, (rawValue) => {
    if (onChange) {
      onChange(rawValue)
    }
  })

  const handleBlur = (e) => {
    hookHandleBlur(e)
    if (externalOnBlur) {
      externalOnBlur(e)
    }
  }

  const handleFocus = (e) => {
    hookHandleFocus(e)
    if (externalOnFocus) {
      externalOnFocus(e)
    }
  }

  /**
   * Get currency symbol based on currency code
   */
  const getCurrencySymbol = () => {
    const curr = (currency || 'UZS').toUpperCase()
    if (curr === 'USD') return '$'
    return ''
  }

  const symbol = getCurrencySymbol()
  const suffix = currency === 'USD' ? '' : ' UZS'

  return (
    <TextField
      ref={inputRef}
      label={label}
      value={displayValue}
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
