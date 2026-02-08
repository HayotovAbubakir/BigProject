import React from 'react'
import { TextField } from '@mui/material'
import { useNumericInput } from '../hooks/useNumericInput'

/**
 * Enhanced NumberField component with improved cursor position management
 * 
 * Replaces the basic NumberField with better UX for formatted numeric input.
 * Maintains cursor position intelligently when formatting is applied.
 * 
 * @param {number|string} value - Current numeric value
 * @param {function} onChange - Callback receiving raw numeric value
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
 * <EnhancedNumberField
 *   value={amount}
 *   onChange={(val) => setAmount(val)}
 *   label="Amount"
 *   fullWidth
 * />
 */
export default function EnhancedNumberField({
  value,
  onChange,
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
      {...rest}
    />
  )
}
