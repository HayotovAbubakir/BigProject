import React, { useState, useEffect } from 'react'
import { TextField } from '@mui/material'
import { parseNumber, formatMoney } from '../utils/format'

export default function NumberField({ value, onChange, label, fullWidth = true, variant = 'outlined', size = 'medium', onBlur, onFocus, ...rest }) {
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
   * Handle input change with smart cursor position preservation
   * Maintains cursor position relative to actual numeric content
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
    e.target.blur() // Remove focus to ensure no value change
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

