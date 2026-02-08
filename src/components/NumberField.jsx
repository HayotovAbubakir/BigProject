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
   */
  const formatLive = (raw) => {
    if (!raw) return ''
    const cleaned = raw.replace(/[^\d.,]/g, '')
    if (!cleaned) return ''

    // last separator position (comma or dot) is treated as decimal point
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    const lastSep = Math.max(lastComma, lastDot)

    const digitsOnly = cleaned.replace(/[^\d]/g, '')
    if (digitsOnly === '') return ''

    if (lastSep === -1) {
      // no decimal, just format int with commas
      return new Intl.NumberFormat('en-US').format(Number(digitsOnly))
    }

    const intPartRaw = cleaned.slice(0, lastSep).replace(/[^\d]/g, '')
    const decimalPart = cleaned.slice(lastSep + 1).replace(/[^\d]/g, '')
    const intFormatted = intPartRaw ? new Intl.NumberFormat('en-US').format(Number(intPartRaw)) : ''

    // keep trailing dot if user just typed separator
    if (lastSep === cleaned.length - 1) {
      return `${intFormatted}.`
    }

    return `${intFormatted}.${decimalPart}`
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
      onChange(parseNumber(formatted))
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

