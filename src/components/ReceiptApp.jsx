

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/useApp'
import { useNumericInput } from '../hooks/useNumericInput'








function formatCurrencyUZS(number) {
  if (number == null || Number.isNaN(Number(number))) return '0 UZS'
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
  return `${fmt.format(Math.round(number))} UZS`
}

function roundUsd(number) {
  if (number == null || Number.isNaN(Number(number))) return '0.00'
  return (Math.round(Number(number) * 100) / 100).toFixed(2)
}

export default function ReceiptApp({ items: propItems }) {
  const { state, dispatch } = useApp()
  const dark = state?.ui?.dark || false
  const rate = state?.ui?.receiptRate || 13000

  // Use numeric input hook for exchange rate with formatting
  const {
    displayValue: rateDisplay,
    handleChange: handleRateChange,
    handleBlur: handleRateBlur,
    inputRef: rateInputRef,
  } = useNumericInput(rate, (rawValue) => {
    if (rawValue && rawValue > 0) {
      dispatch({ type: 'SET_UI', payload: { receiptRate: rawValue } })
      dispatch({ type: 'SET_EXCHANGE_RATE', payload: rawValue })
    }
  })

  const [alertVisible, setAlertVisible] = useState(true)
  const demoItems = [
    { name: 'Premium Coffee Beans', qty: 2, unitPrice: 12.5, currency: 'USD' },
    { name: 'Cafe Espresso Cups', qty: 10, unitPrice: 15000, currency: 'UZS' },
    { name: 'Thermal Filters', qty: 1, unitPrice: 45.25, currency: 'USD' },
    { name: 'Sugar (kg)', qty: 3, unitPrice: 3000, currency: 'UZS' },
  ]
  const items = propItems && Array.isArray(propItems) ? propItems : demoItems

  const containerRef = useRef(null)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })

  useEffect(() => {
    try {
      const el = document.documentElement
      if (dark) el.classList.add('dark')
      else el.classList.remove('dark')
    } catch (err) { void err }
  }, [dark])

  

  const sums = useMemo(() => {
    let sumUsd = 0
    let sumUzs = 0
    items.forEach((it) => {
      const qty = Number(it.qty) || 0
      const up = Number(it.unitPrice) || 0
      if ((it.currency || 'UZS').toUpperCase() === 'USD') {
        sumUsd += qty * up
      } else {
        sumUzs += qty * up
      }
    })
    const totalUzs = Math.round(sumUzs + Math.round(sumUsd * rate))
    return { sumUsd, sumUzs, totalUzs }
  }, [items, rate])

  const handlePointerMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setPointer({ x: (e.clientX - cx) / rect.width, y: (e.clientY - cy) / rect.height })
  }

  useEffect(() => {
    setAlertVisible(true)
    const t = setTimeout(() => setAlertVisible(false), 3500)
    return () => clearTimeout(t)
  }, [rate])

  

  const styleKeyframes = `
    @keyframes floatY {
      0% { transform: translateY(0px) translateX(0px) }
      50% { transform: translateY(-18px) translateX(6px) }
      100% { transform: translateY(0px) translateX(0px) }
    }
    @keyframes drift {
      0% { transform: translateY(0) translateX(0) rotate(0deg) }
      50% { transform: translateY(-30px) translateX(20px) rotate(12deg) }
      100% { transform: translateY(0) translateX(0) rotate(0deg) }
    }
    @keyframes slideDown {
      0% { transform: translateY(-120%); opacity: 0 }
      60% { transform: translateY(8%); opacity: 1 }
      100% { transform: translateY(0); opacity: 1 }
    }
  `

  return (
    <div
      ref={containerRef}
      onMouseMove={handlePointerMove}
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 dark:from-black dark:via-slate-900"
    >
      <style>{styleKeyframes}</style>

      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ transform: `translate3d(${pointer.x * 6}px, ${pointer.y * 6}px, 0)` }}>
        <div className="absolute inset-0 opacity-60 mix-blend-screen">
          <div className="absolute rounded-full bg-gradient-to-tr from-indigo-500/40 via-violet-400/30 to-pink-400/30 blur-3xl" style={{ width: 520, height: 520, left: '5%', top: '10%', animation: 'floatY 12s ease-in-out infinite', transform: `translate3d(${pointer.x * -10}px, ${pointer.y * -6}px, 0)` }} />
          <div className="absolute rounded-full bg-gradient-to-br from-emerald-300/30 via-cyan-300/20 to-blue-400/20 blur-2xl" style={{ width: 360, height: 360, right: '8%', top: '20%', animation: 'drift 18s ease-in-out infinite', transform: `translate3d(${pointer.x * -6}px, ${pointer.y * 10}px, 0)` }} />
          <div className="absolute rounded-full bg-gradient-to-tr from-yellow-300/20 via-orange-300/20 to-rose-300/10 blur-2xl" style={{ width: 260, height: 260, left: '40%', bottom: '8%', animation: 'floatY 16s ease-in-out infinite', transform: `translate3d(${pointer.x * 6}px, ${pointer.y * -8}px, 0)` }} />
          <div className="absolute rounded-full bg-white/6 blur-xl" style={{ width: 140, height: 140, right: '30%', bottom: '30%', animation: 'floatY 10s ease-in-out infinite', transform: `translate3d(${pointer.x * 3}px, ${pointer.y * 3}px, 0)` }} />
        </div>
      </div>

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 w-full max-w-2xl px-4">
        {alertVisible && (
          <div className="mx-auto max-w-2xl rounded-xl shadow-lg overflow-hidden animate-[slideDown_650ms_ease]">
            <div className="bg-gradient-to-r from-indigo-600 to-rose-500 text-white p-3 rounded-xl border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse-slow">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2v4M12 18v4M4.22 4.22l2.8 2.8M17 17l2.8 2.8M2 12h4M18 12h4M4.22 19.78l2.8-2.8M17 7l2.8-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">Ta'lim</div>
                  <div className="text-sm opacity-90">Exchange rate set to 1 USD = {formatCurrencyUZS(rate).replace(' UZS', '')} UZS</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setAlertVisible(false)} className="text-white/90 hover:text-white bg-white/5 px-3 py-1 rounded-md transition">Dismiss</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-slate-50 drop-shadow-sm">Receipt Preview</h1>
            <p className="text-sm text-slate-300">Mixed-currency receipt with global exchange conversion and responsive UI</p>
          </div>

            <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/6 px-3 py-2 rounded-lg border border-white/6 backdrop-blur-sm">
              <label className="text-sm text-slate-200 mr-2">1 USD =</label>
              <input 
                ref={rateInputRef}
                type="text" 
                value={rateDisplay} 
                onChange={handleRateChange}
                onBlur={handleRateBlur}
                className="w-28 bg-transparent text-white placeholder:text-slate-300 outline-none text-right"
                inputMode="decimal"
                placeholder="13000"
              />
              <span className="ml-2 text-sm text-slate-200">UZS</span>
            </div>

            <button onClick={() => dispatch({ type: 'SET_UI', payload: { dark: !dark } })} aria-label="Toggle dark mode" className="p-2 rounded-md bg-white/6 border border-white/6 text-slate-100 hover:scale-105 transition-transform" title="Toggle dark mode">
              {dark ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.43 2.3a9 9 0 1010.27 10.27 7 7 0 01-10.27-10.27z" /></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10-9h2V1h-2v3zm7.03 2.05l1.79-1.79-1.8-1.8-1.79 1.8 1.8 1.79zM17.24 19.16l1.8 1.79 1.79-1.79-1.79-1.79-1.8 1.79zM20 11v2h3v-2h-3zM12 6a6 6 0 100 12 6 6 0 000-12zM6.76 19.16l-1.8 1.79 1.79 1.79 1.8-1.79-1.79-1.79zM11 23h2v-3h-2v3z" /></svg>
              )}
            </button>
          </div>
        </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity duration-500 ease-out opacity-100 transform translate-y-0">
          <div className="p-6 rounded-xl bg-white/5 border border-white/6 backdrop-blur-md shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">Items</h2>

            <ul className="space-y-3">
              {items.map((it, idx) => {
                const subtotal = Number(it.qty || 0) * Number(it.unitPrice || 0)
                const isUsd = (it.currency || 'UZS').toUpperCase() === 'USD'
                return (
                  <li key={idx} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-gradient-to-b from-white/3 to-white/2/5 hover:shadow-md transform transition-transform duration-200 hover:scale-105" style={{ boxShadow: '0 6px 18px rgba(2,6,23,0.45)' }}>
                    <div>
                      <div className="font-medium text-white">{it.name}</div>
                      <div className="text-sm text-slate-300">{it.qty} × {isUsd ? `$${roundUsd(it.unitPrice)}` : `${formatCurrencyUZS(it.unitPrice)}`}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-white">{isUsd ? `$${roundUsd(subtotal)}` : formatCurrencyUZS(subtotal)}</div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="mt-6 border-t border-white/6 pt-4">
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span>Sum (USD)</span>
                <span className="font-medium text-white">${roundUsd(sums.sumUsd)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300 mb-2">
                <span>Sum (UZS)</span>
                <span className="font-medium text-white">{formatCurrencyUZS(sums.sumUzs)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-200 text-lg font-semibold mt-3">
                <span>Jami (UZS)</span>
                <span className="text-xl bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-emerald-300">{formatCurrencyUZS(sums.totalUzs)}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white/4 border border-white/6 backdrop-blur-md shadow-2xl flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-300">Receipt</div>
                <div className="text-2xl font-extrabold text-white">Invoice # {String(Math.abs(Math.floor(Math.random() * 90000))).padStart(5, '0')}</div>
                <div className="text-xs text-slate-400 mt-1">Date: {new Date().toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-300">Currency view</div>
                <div className="text-lg font-bold text-white mt-1">USD • UZS</div>
              </div>
            </div>

            <div className="mt-6 flex-1">
              <div className="rounded-lg bg-white/3 p-4 border border-white/6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">Jami (USD)</div>
                  <div className="text-lg font-semibold text-white">${roundUsd(sums.sumUsd)}</div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-slate-300">Rate</div>
                  <div className="text-sm font-medium text-white">1 USD = {formatCurrencyUZS(rate)}</div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-slate-300">Converted (USD → UZS)</div>
                  <div className="text-sm font-medium text-white">{formatCurrencyUZS(Math.round(sums.sumUsd * rate))}</div>
                </div>

                <div className="mt-6 border-t border-white/6 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-300">Jami (UZS)</div>
                    <div className="text-2xl font-bold text-white">{formatCurrencyUZS(sums.totalUzs)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => { setAlertVisible(true); setTimeout(() => setAlertVisible(false), 2000) }} className="flex-1 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-rose-500 text-white font-semibold hover:brightness-105 transition">Checkout</button>

              <button onClick={() => { const payload = { items, rate, sums, date: new Date().toISOString() }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `receipt-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); }} className="py-3 px-4 rounded-lg bg-white/5 border border-white/6 text-white hover:scale-102 transition">Export</button>
            </div>

            <div className="mt-6 text-xs text-slate-400">
              <div>Note: USD sum is shown rounded to two decimals as required. UZS totals are integer with thousands separators.</div>
            </div>
          </div>
  </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          <span>Drop this component into your project. Ensure Tailwind + Framer Motion are installed. </span>
        </div>
      </div>
    </div>
  )
}
