import { useState, useCallback, useRef, useEffect } from 'react'
import { parseNumber, formatMoney } from '../utils/format'

/**
 * Enhanced hook for numeric input with live formatting and cursor position preservation
 * 
 * Features:
 * - Real-time formatting with thousands separators
 * - Smart cursor position preservation
 * - Only numeric input allowed
 * - Returns raw numeric value for calculations
 * - Handles decimal input gracefully
 * - No external dependencies
 * 
 * @param {number|string} initialValue - Initial numeric value
 * @param {function} onValueChange - Callback with raw numeric value and display value
 * @returns {object} Hook state and handlers
 * 
 * @example
 * const { displayValue, rawValue, handleChange, handleBlur, handleFocus } = useNumericInput(1000, (raw, display) => {
 *   console.log('Raw:', raw, 'Display:', display)
 * })
 * 
 * return <input value={displayValue} onChange={handleChange} onBlur={handleBlur} onFocus={handleFocus} />
 */
export function useNumericInput(initialValue = '', onValueChange = null) {
  const [displayValue, setDisplayValue] = useState(
    initialValue === null || initialValue === '' ? '' : formatMoney(initialValue)
  )
  const [rawValue, setRawValue] = useState(parseNumber(initialValue) || null)
  const inputRef = useRef(null)
  const lastValueRef = useRef(displayValue)

  /**
   * Calculate cursor position adjustment after formatting
   * Preserves relative cursor position based on digit count
   */
  const calculateCursorPosition = useCallback((oldDisplay, newDisplay, oldCursorPos) => {
    if (!oldDisplay || !newDisplay) return 0

    // Count digits before cursor in old value
    const digitsBeforeCursorOld = (oldDisplay.slice(0, oldCursorPos).match(/\d/g) || []).length

    // Find position where we've typed 'digitsBeforeCursorOld' digits
    let digitCount = 0
    for (let i = 0; i < newDisplay.length; i++) {
      if (/\d/.test(newDisplay[i])) {
        digitCount++
        if (digitCount === digitsBeforeCursorOld) {
          return i + 1
        }
      }
    }

    return newDisplay.length
  }, [])

  /**
   * Format string with thousands separators while preserving decimal input
   * Uses explicit comma formatting to ensure consistency regardless of locale
   */
  const formatLive = useCallback((raw) => {
    if (!raw) return ''

    // Remove all non-numeric characters except dot
    const cleaned = raw.replace(/[^\d.]/g, '')
    if (!cleaned || cleaned === '.') return ''

    // Split by dot to separate integer and decimal parts
    const parts = cleaned.split('.')
    const intPart = parts[0]
    const decPart = parts[1]

    // Format integer part with commas: 1000000 → 1,000,000
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
  }, [])

  /**
   * Handle input change with live formatting
   */
  const handleChange = useCallback((e) => {
    const input = e.target
    const oldDisplay = lastValueRef.current
    const oldCursorPos = input.selectionStart || 0

    const formatted = formatLive(input.value)
    setDisplayValue(formatted)
    lastValueRef.current = formatted

    const newRawValue = formatted ? parseNumber(formatted) : null
    setRawValue(newRawValue)

    // Restore cursor position
    if (formatted !== oldDisplay) {
      const newCursorPos = calculateCursorPosition(oldDisplay, formatted, oldCursorPos)
      // Use setTimeout to ensure cursor position is set after render
      setTimeout(() => {
        input.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    }

    if (onValueChange) {
      onValueChange(newRawValue, formatted)
    }
  }, [formatLive, calculateCursorPosition, onValueChange])

  /**
   * Handle blur - finalize formatting
   */
  const handleBlur = useCallback((e) => {
    const formatted = displayValue ? formatMoney(parseNumber(displayValue)) : ''
    setDisplayValue(formatted)
    lastValueRef.current = formatted

    const newRawValue = formatted ? parseNumber(formatted) : null
    setRawValue(newRawValue)

    if (onValueChange) {
      onValueChange(newRawValue, formatted)
    }
  }, [displayValue, onValueChange])

  /**
   * Handle focus - optionally select all for quick replacement
   */
  const handleFocus = useCallback((e) => {
    // Optional: uncomment to select all on focus
    // e.target.select()
  }, [])

  /**
   * Handle wheel to prevent accidental value changes
   */
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (inputRef.current) {
      inputRef.current.blur()
    }
  }, [])

  /**
   * Programmatically set value
   */
  const setValue = useCallback((value) => {
    const newDisplay = value === null || value === '' ? '' : formatMoney(value)
    setDisplayValue(newDisplay)
    lastValueRef.current = newDisplay
    const newRawValue = parseNumber(newDisplay)
    setRawValue(newRawValue)

    if (onValueChange) {
      onValueChange(newRawValue, newDisplay)
    }
  }, [onValueChange])

  return {
    displayValue,
    rawValue,
    handleChange,
    handleBlur,
    handleFocus,
    handleWheel,
    setValue,
    inputRef,
  }
}

export default useNumericInput
