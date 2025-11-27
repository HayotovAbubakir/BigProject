import React, { useState, useEffect } from 'react'
import { Grid, Card, CardContent, Typography, useTheme, useMediaQuery, Box, TextField, Button } from '@mui/material'
import { useApp } from '../context/AppContext'
import useExchangeRate from '../hooks/useExchangeRate'
import { formatMoney, parseNumber } from '../utils/format'
import ReactApexChart from 'react-apexcharts'
import { monthShortFromISO } from '../utils/date'
import { useLocale } from '../context/LocaleContext'
import DailySalesByDate from '../components/DailySalesByDate'
import MostSoldPie from '../components/MostSoldPie'

const sampleMonthlyInit = [
  { month: 'Yan', sold: 120, in: 200 },
  { month: 'Feb', sold: 90, in: 150 },
  { month: 'Mar', sold: 200, in: 180 },
  { month: 'Apr', sold: 170, in: 140 },
  { month: 'May', sold: 220, in: 210 },
]

const PIE_DATA_INIT = [
  { name: 'Choy', value: 400 },
  { name: 'Qahva', value: 300 },
  { name: 'Non', value: 300 },
]
const COLORS = ['#0088FE', '#00C49F', '#FFBB28']

function Dashboard() {
  const { state } = useApp()
  // daily/per-day widgets removed from Dashboard per request

  // Build simple monthly aggregates from logs
  const logs = React.useMemo(() => state.logs || [], [state.logs])
  // operations count removed from UI; keep logs available

  // USD->UZS conversion control removed per request. Dashboard shows UZS-only aggregates.

  // income/expense/profit removed from UI per request

  // Dev-only debug: print per-log breakdown to console to help debug profit issues
  if (typeof window !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    try {
    } catch {
      // ignore debug errors
    }
  }

  // Monthly chart: group by month from log.date (use ISO month to avoid tz shifting)
  const sampleMonthly = React.useMemo(() => {
    const monthlyMap = {} 
    logs.forEach(l => {
      // Prefer UZS totals if provided on the log (total_uzs / amount_uzs), otherwise fall back to amount
      const amt = parseNumber(l.total_uzs ?? l.amount_uzs ?? l.amount ?? 0)
      if (!amt) return
      const d = l.date || new Date().toISOString().slice(0, 10)
      const m = monthShortFromISO(d) || (new Date().toLocaleString('default', { month: 'short' }))
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, sold: 0, in: 0 }
      // Use explicit kind to determine sold vs in. 'SELL' counts as sold; others count as incoming/added.
      if (l.kind === 'SELL') monthlyMap[m].sold += amt
      else monthlyMap[m].in += amt
    })
    const vals = Object.values(monthlyMap)
    return vals.length ? vals : sampleMonthlyInit
  }, [logs])

  // Build PIE data and topProduct from logs (memoized)
  const { PIE_DATA, topProduct } = React.useMemo(() => {
    const categoryMap = { Qahva: 0, Choy: 0, Non: 0, Boshqa: 0 }
    const productQty = {}
    // Only consider SELL logs for sold aggregations and top product
    logs.filter(l => l.kind === 'SELL').forEach(l => {
      const amt = parseNumber(l.total_uzs ?? l.amount_uzs ?? l.amount ?? 0)
      if (amt) {
        const text = (l.detail || '').toLowerCase()
        if (text.includes('qahva')) categoryMap.Qahva += amt
        else if (text.includes('choy') || text.includes('chai')) categoryMap.Choy += amt
        else if (text.includes('non')) categoryMap.Non += amt
        else categoryMap.Boshqa += amt
      }

      const name = (l.productName || "Noma'lum").toString()
      const qty = Number(l.qty || 0)
      if (!productQty[name]) productQty[name] = 0
      productQty[name] += qty
    })

    // Prefer monetary category totals when available; otherwise fall back to product quantities so the pie isn't empty
    const categoryTotal = Object.values(categoryMap).reduce((s, v) => s + (Number(v) || 0), 0)
    let PIE_DATA = []
    if (categoryTotal > 0) {
      PIE_DATA = Object.keys(categoryMap).map(k => ({ name: k, value: categoryMap[k] }))
    } else {
      const entries = Object.entries(productQty)
      if (!entries.length) {
        PIE_DATA = PIE_DATA_INIT
      } else {
        entries.sort((a, b) => b[1] - a[1])
        const topN = 6
        const topEntries = entries.slice(0, topN)
        const other = entries.slice(topN).reduce((s, [, v]) => s + v, 0)
        PIE_DATA = topEntries.map(([name, qty]) => ({ name, value: qty }))
        if (other > 0) PIE_DATA.push({ name: 'Boshqa', value: other })
      }
    }

    let top = null
    const prodEntries = Object.entries(productQty)
    if (prodEntries.length) {
      prodEntries.sort((a, b) => b[1] - a[1])
      const [name, qty] = prodEntries[0]
      top = { name, qty }
    }
    return { PIE_DATA, topProduct: top }
  }, [logs])

  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const isSm = useMediaQuery(theme.breakpoints.between('sm', 'md'))
  const { t } = useLocale()
  // per-day filtering: dashboard provides a date picker-controlled daily widget
  const today = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = React.useState(today)
  const [acctFilterDate, setAcctFilterDate] = React.useState(today)


  // avoid rendering charts until after client mount to prevent Recharts measuring 0/-1 sizes
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // wait for the next frame so layout measurements stabilize before rendering charts
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // phone-first heights: make charts taller on small screens so they remain legible
  const chartHeight = isXs ? 260 : isSm ? 220 : 200
  const chartMaxWidth = isXs ? '100%' : '100%'

  // compute store and warehouse total values, converting USD-priced products into UZS
  const { rate: usdToUzs } = useExchangeRate()

  // compute store and warehouse total values, converting USD-priced products into UZS
  // If a USD product lacks a stored UZS copy and no exchange rate is available, skip it to avoid mislabelled totals.
  const { warehouseValue, warehouseSkipped } = (state.warehouse || []).reduce((acc, it) => {
    const qty = Number(it.qty || 0)
    let unit = parseNumber(it.cost || 0)
    if ((it.currency || 'UZS') === 'USD') {
      if (typeof it.cost_uzs === 'number' && !Number.isNaN(it.cost_uzs)) unit = Number(it.cost_uzs)
      else if (usdToUzs) unit = unit * usdToUzs
      else {
        // cannot convert this USD item to UZS now
        return { warehouseValue: acc.warehouseValue, warehouseSkipped: acc.warehouseSkipped + 1 }
      }
    }
    return { warehouseValue: acc.warehouseValue + qty * unit, warehouseSkipped: acc.warehouseSkipped }
  }, { warehouseValue: 0, warehouseSkipped: 0 })

  const { storeValue, storeSkipped } = (state.store || []).reduce((acc, it) => {
    const qty = Number(it.qty || 0)
    let unit = parseNumber(it.price || it.cost || 0)
    if ((it.currency || 'UZS') === 'USD') {
      if (typeof it.price_uzs === 'number' && !Number.isNaN(it.price_uzs)) unit = Number(it.price_uzs)
      else if (usdToUzs) unit = unit * usdToUzs
      else {
        return { storeValue: acc.storeValue, storeSkipped: acc.storeSkipped + 1 }
      }
    }
    return { storeValue: acc.storeValue + qty * unit, storeSkipped: acc.storeSkipped }
  }, { storeValue: 0, storeSkipped: 0 })

  return (
    <Box sx={{ display: 'flex', justifyContent: 'start', alignItems: 'center' }}>
      <Box sx={{ width: '100%', px: { xs: 2, sm: 2, md: 0 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant={isXs ? 'h5' : 'h4'} gutterBottom>{t('overview')}</Typography>
        </Box>

        <Grid container spacing={2}>
          {/* Per-day sales (defaults to today). Change date to filter daily sales. */}
          <Grid item xs={12} md={6} sx={{ order: { xs: 4, md: 0 } }}>
            <DailySalesByDate selectedDate={selectedDate} onDateChange={setSelectedDate} />
          </Grid>

          {/* Accounts sales share card */}
          <Grid item xs={12} md={6} sx={{ order: { xs: 5, md: 0 } }}>
            <Card sx={{ overflow: 'visible' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant={isXs ? 'subtitle1' : 'h6'}>{t('accounts_sales_share')}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField size="small" type="date" value={acctFilterDate} onChange={(e) => setAcctFilterDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                    <Button size="small" variant="outlined" onClick={() => setAcctFilterDate(today)}>{t('today')}</Button>
                  </Box>
                </Box>
                {mounted ? (() => {
                  // compute sales by account for the selected account date
                  const users = ['hamdamjon', 'shogirt', 'habibjon']
                  const counts = { hamdamjon: 0, shogirt: 0, habibjon: 0, other: 0 }
                  logs.filter(l => (l.kind === 'SELL') && (l.date || '').slice(0,10) === acctFilterDate).forEach(l => {
                    const amt = Number(l.total_uzs ?? l.amount_uzs ?? (l.currency === 'USD' && usdToUzs ? Math.round(Number(l.amount || 0) * usdToUzs) : (l.currency === 'USD' ? (l.amount_uzs ?? Math.round(Number(l.amount || 0))) : Number(l.amount || 0)))) || 0
                    const who = (l.user || '').toString().toLowerCase()
                    if (who.includes('hamdamjon')) counts.hamdamjon += amt
                    else if (who.includes('shogirt')) counts.shogirt += amt
                    else if (who.includes('habibjon')) counts.habibjon += amt
                    else counts.other += amt
                  })
                  const labels = ['Hamdamjon', 'Shogirt', 'Habibjon', 'Other']
                  const data = [counts.hamdamjon, counts.shogirt, counts.habibjon, counts.other]
                  const total = data.reduce((s, v) => s + v, 0) || 1
                  const pct = data.map(v => Math.round((v / total) * 100))
                  return (
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center', flexDirection: { xs: 'column', md: 'row' } }}>
                      <Box sx={{ width: { xs: '100%', md: 220 }, height: 220 }}>
                        <ReactApexChart type="pie" series={data} options={{ labels, legend: { show: false }, colors: ['#0088FE', '#00C49F', '#FFBB28', '#cccccc'], tooltip: { y: { formatter: (v) => `${formatMoney(v)} UZS` } } }} height={220} />
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {labels.map((lab, idx) => (
                          <Box key={lab} sx={{ display: 'flex', justifyContent: 'space-between', minWidth: 180 }}>
                            <Typography variant="body2">{lab}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{pct[idx]}% • {formatMoney(data[idx])} UZS</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )
                })() : <Box sx={{ height: 220 }} />}
              </CardContent>
            </Card>
          </Grid>

          {/* Aggregated daily sales report removed per request */}

          {/* Recent actions / quick operations removed as requested */}

          <Grid item xs={12} md={6} sx={{ order: { xs: 2, md: 0 } }}>
            <Card sx={{ overflow: 'visible' }}>
              <CardContent>
                <Typography variant={isXs ? 'subtitle1' : 'h6'}>{t('monthly_analysis')}</Typography>
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <Box sx={{ width: '100%', px: { xs: 0, sm: 0 }, height: chartHeight + (isXs ? 80 : 0), minHeight: 160, overflow: 'visible', position: 'relative', minWidth: 0 }}>
                    {mounted ? (
                      <div style={{ width: '100%', height: '100%' }}>
                        <ReactApexChart
                          type="line"
                          series={[
                            { name: t('sold') || 'Sold', data: sampleMonthly.map(m => m.sold) },
                            { name: t('in') || 'In', data: sampleMonthly.map(m => m.in) },
                          ]}
                          options={{
                            chart: { toolbar: { show: false }, animations: { enabled: true }, zoom: { enabled: false } },
                            stroke: { curve: 'smooth', width: 2 },
                            colors: ['#8884d8', '#82ca9d'],
                            markers: { size: 0 },
                            xaxis: { categories: sampleMonthly.map(m => m.month), labels: { style: { colors: 'rgba(15,23,36,0.6)' } }, axisBorder: { color: 'rgba(15,23,36,0.08)' } },
                            yaxis: { labels: { formatter: (v) => formatMoney(v), style: { colors: 'rgba(15,23,36,0.6)' } } },
                            tooltip: { y: { formatter: (v) => `${formatMoney(v)} UZS` } },
                            legend: { show: false },
                            grid: { borderColor: 'rgba(15,23,36,0.04)' },
                            responsive: [
                              { breakpoint: 768, options: { chart: { height: chartHeight } } }
                            ]
                          }}
                          height={chartHeight}
                        />
                      </div>
                    ) : <div style={{ width: chartMaxWidth, height: chartHeight }} />}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>


          <Grid item xs={12} md={6} sx={{ order: { xs: 1, md: 0 } }}>
            <Card sx={{ overflow: 'visible' }}>
              <CardContent>
                <Typography variant={isXs ? 'subtitle1' : 'h6'}>{t('most_sold')}</Typography>
                {topProduct ? (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant={isXs ? 'h6' : 'h5'} sx={{ fontWeight: 600 }}>{topProduct.name}</Typography>
                    <Typography variant="body2">{t('total_sold', { count: topProduct.qty })}</Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ mb: 1 }}>{t('no_data')}</Typography>
                )}
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <Box sx={{ width: { xs: '100%', sm: '100%', md: '100%' }, maxWidth: 420, overflow: 'visible', position: 'relative', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                    {(() => {
                      const data = PIE_DATA.filter(d => d.value > 0).map((d, i) => ({ ...d, color: COLORS[i % COLORS.length] }))
                      if (!data || data.length === 0) return <Typography variant="body2" color="text.secondary">{t('chartNoData')}</Typography>
                      const size = isXs ? 140 : isSm ? 180 : 200
                      const centerLabel = topProduct ? { title: topProduct.name, subtitle: `${t('total_sold', { count: topProduct.qty })}` } : null
                      return <MostSoldPie data={data} size={size} innerRadius={Math.round(size * 0.26)} centerLabel={centerLabel} />
                    })()}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Warehouse vs Store comparison chart (Material UI only) */}
          <Grid item xs={12} sx={{ flexBasis: { md: '100%' }, maxWidth: { md: '100%' }, order: { xs: 3, md: 0 } }}>
            <Card>
              <CardContent>
                <Typography variant={isXs ? 'subtitle1' : 'h6'} sx={{ mb: 1 }}>{t('warehouse_store_comparison')}</Typography>

                {/** compute percentages to render proportional bars */}
                {(() => {
                  const total = (warehouseValue + storeValue) || 1
                  const whPct = Math.round((warehouseValue / total) * 100)
                  const stPct = 100 - whPct
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2" color="text.secondary">{t('warehouse')}</Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{formatMoney(warehouseValue)} UZS</Typography>
                        </Box>
                        <Box sx={{ height: 14, borderRadius: 2, background: 'rgba(15,23,36,0.08)', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${whPct}%`, background: 'linear-gradient(90deg,#8884d8,#7b61ff)' }} />
                        </Box>
                      </Box>

                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2" color="text.secondary">{t('store')}</Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{formatMoney(storeValue)} UZS</Typography>
                        </Box>
                        <Box sx={{ height: 14, borderRadius: 2, background: 'rgba(15,23,36,0.08)', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${stPct}%`, background: 'linear-gradient(90deg,#82ca9d,#2bb673)' }} />
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">{t('total_value', { value: formatMoney(warehouseValue + storeValue) })} UZS</Typography>
                        <Typography variant="caption" color="text.secondary">{t('warehouse_store_pct', { whPct, stPct })}</Typography>
                      </Box>
                      {(storeSkipped + warehouseSkipped) > 0 ? (
                        <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>{t('excluded_usd_items', { count: (storeSkipped + warehouseSkipped) })}</Typography>
                      ) : null}
                    </Box>
                  )
                })()}

              </CardContent>
            </Card>
          </Grid>

          {/* summary cards moved to top for mobile; desktop will render them via the first Grid block */}
        </Grid>
      </Box>
    </Box>
  )
}

export default React.memo(Dashboard)
