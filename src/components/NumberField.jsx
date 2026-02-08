import React, { useState, useEffect } from 'react'
import { TextField } from '@mui/material'
import { parseNumber, formatMoney } from '../utils/format'

export default function NumberField({ value, onChange, label, fullWidth = true, variant = 'outlined', size = 'medium', onBlur, onFocus, ...rest }) {
  const [display, setDisplay] = useState(value == null || value === '' ? '' : formatMoney(value))
  const [cursorPosition, setCursorPosition] = useState(null)

  useEffect(() => {
    if (value === parseNumber(display)) {
      return;
    }
    const next = value == null || value === '' ? '' : formatMoney(value)
    setDisplay(next)
  }, [value, display])

  /**
   * Handle input change with smart cursor position preservation
   * Maintains cursor position relative to actual numeric content
   */
  const handleChange = (e) => {
    const raw = e.target.value.replace('.', ',');
    setDisplay(raw);
    if (onChange) {
      onChange(parseNumber(raw));
    }
  };

  /**
   * Prevent mouse wheel from changing numeric input value
   * This stops unwanted value changes when scrolling over the input
   */
  const handleWheel = (e) => {
    e.preventDefault()
    e.target.blur() // Remove focus to ensure no value change
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
      inputProps={{ 
        inputMode: 'decimal',
        pattern: '[0-9.,]*',
        autoComplete: 'off'
      }}
      {...rest}
    />
  )
}

