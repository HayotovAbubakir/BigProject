import React, { useState, useRef, useEffect } from 'react'
import { parseNumber } from '../utils/format'

/**
 * FixedNumericInput - Numeric input with consistent comma formatting
 * 
 * Features:
 * - Starts EMPTY by default (not 0)
 * - Real-time formatting with thousands separators (commas)
 * - Consistent formatting during typing and after blur
 * - Only numeric input allowed
 * - Cursor position preserved
 * - Raw numeric value available via onChange
 * 
 * @param {number|string|null} value - Current numeric value (empty string or null = empty field)
 * @param {function} onChange - Callback with raw numeric value or null
 * @param {object} props - Additional input attributes
 * 
 * @example
 * <FixedNumericInput
 *   value={price}
 *   onChange={setPrice}
 *   placeholder="Enter price"
 * />
 * // User sees empty field initially
 * // Type: 1234567 → displays 1,234,567 → backend gets 1234567
 */
export default function FixedNumericInput({
  value = '',
  onChange,
  onBlur,
  onFocus,
  placeholder = '',
  ...props
}) {
  const [display, setDisplay] = useState('')
  const inputRef = useRef(null)

  // Initialize display value on mount or value change
  useEffect(() => {
    const num = parseNumber(value)
    const formatted = num ? formatNumberExplicit(num) : ''
    setDisplay(formatted)
  }, [value])

  /**
   * Explicitly format number with COMMA thousands separator
   * Avoids any locale issues
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
   * Count digits before cursor position in string
   */
  function countDigitsBeforeCursor(str, cursorPos) {
    return (str.substring(0, cursorPos).match(/\d/g) || []).length
  }

  /**
   * Find cursor position after formatting based on digit count
   */
  function findCursorPositionByDigits(str, digitCount) {
    let digits = 0
    for (let i = 0; i < str.length; i++) {
      if (/\d/.test(str[i])) {
        digits++
        if (digits === digitCount) {
          return i + 1
        }
      }
    }
    return str.length
  }

  /**
   * Handle input change with live formatting and cursor preservation
   */
  function handleChange(e) {
    const input = e.target
    const raw = input.value
    const cursorPos = input.selectionStart

    // Extract only digits and one dot for decimal
    let cleaned = raw.replace(/[^\d.]/g, '')
    
    // Prevent multiple dots
    const dotCount = (cleaned.match(/\./g) || []).length
    if (dotCount > 1) {
      const lastDotIndex = cleaned.lastIndexOf('.')
      cleaned = cleaned.substring(0, lastDotIndex) + cleaned.substring(lastDotIndex + 1).replace(/\./g, '')
    }

    // If empty, clear display
    if (!cleaned || cleaned === '.') {
      setDisplay('')
      onChange(null)
      return
    }

    // Parse to number and back to formatted
    const num = parseNumber(cleaned)
    const formatted = formatNumberExplicit(num)

    // Track digits before cursor in original input
    const digitsBeforeCursor = countDigitsBeforeCursor(raw, cursorPos)

    setDisplay(formatted)

    // Send raw numeric value to parent
    onChange(num)

    // Restore cursor position next frame
    setTimeout(() => {
      const newCursorPos = findCursorPositionByDigits(formatted, digitsBeforeCursor)
      input.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  /**
   * Handle blur - finalize formatting
   */
  function handleBlurInternal(e) {
    const num = parseNumber(display)
    const formatted = num ? formatNumberExplicit(num) : ''
    setDisplay(formatted)
    onChange(num)
    if (onBlur) onBlur(e)
  }

  /**
   * Handle focus
   */
  function handleFocusInternal(e) {
    if (onFocus) onFocus(e)
  }

  /**
   * Prevent mouse wheel from changing value
   */
  function handleWheel(e) {
    e.preventDefault()
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={display}
      onChange={handleChange}
      onBlur={handleBlurInternal}
      onFocus={handleFocusInternal}
      onWheel={handleWheel}
      placeholder={placeholder}
      inputMode="decimal"
      {...props}
    />
  )
}
