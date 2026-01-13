import React, { useState, useEffect } from 'react'
import { TextField } from '@mui/material'
import { parseNumber, formatMoney } from '../utils/format'

export default function NumberField({ value, onChange, label, fullWidth = true, variant = 'outlined', size = 'medium', onBlur, onFocus, ...rest }) {
  const [display, setDisplay] = useState(value == null || value === '' ? '' : formatMoney(value))

  useEffect(() => {
    const next = value == null || value === '' ? '' : formatMoney(value)
    setDisplay(next)
  }, [value])

  const handleChange = (e) => {
    const raw = e.target.value
    const num = parseNumber(raw)
    const formatted = formatMoney(num)
    setDisplay(formatted)
    if (onChange) onChange(num)
  }

  return (
    <TextField
      label={label}
      value={display}
      onChange={handleChange}
      onBlur={onBlur}
      onFocus={onFocus}
      fullWidth={fullWidth}
      variant={variant}
      size={size}
      inputProps={{ inputMode: 'numeric', pattern: '[0-9 ]*' }}
      {...rest}
    />
  )
}
