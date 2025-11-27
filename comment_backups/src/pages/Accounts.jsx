import React from 'react'
import { Typography, Card, CardContent, Grid, Box } from '@mui/material'
import { formatMoney } from '../utils/format'
import { useApp } from '../context/AppContext'
import useExchangeRate from '../hooks/useExchangeRate'
import useDisplayCurrency from '../hooks/useDisplayCurrency'

export default function Accounts() {
  const { state } = useApp()

  const { displayCurrency, formatForDisplay } = useDisplayCurrency()
  const { rate: usdToUzs } = useExchangeRate()

  // compute totals in UZS (converting USD items); fall back to price_uzs/cost_uzs when available
  const warehouseValueUzs = state.warehouse.reduce((s, it) => {
    const qty = Number(it.qty || 0)
    let unit = Number(it.cost || 0)
    if ((it.currency || 'UZS') === 'USD') {
      if (typeof it.cost_uzs === 'number' && !Number.isNaN(it.cost_uzs)) unit = Number(it.cost_uzs)
      else if (usdToUzs) unit = unit * usdToUzs
      else unit = 0
    }
    return s + qty * unit
  }, 0)

  const storeValueUzs = state.store.reduce((s, it) => {
    const qty = Number(it.qty || 0)
    let unit = Number(it.price || it.cost || 0)
    if ((it.currency || 'UZS') === 'USD') {
      if (typeof it.price_uzs === 'number' && !Number.isNaN(it.price_uzs)) unit = Number(it.price_uzs)
      else if (usdToUzs) unit = unit * usdToUzs
      else unit = 0
    }
    return s + qty * unit
  }, 0)

  // Compute credits totals separately in UZS (do NOT mix into net balance)
  const totalOlinganUZS = state.credits.filter(c => c.type === 'olingan').reduce((s, c) => {
    const amt = Number(c.amount || 0)
    const cur = (c.currency || 'UZS')
    if (cur === 'USD') {
      if (usdToUzs) return s + Math.round(amt * usdToUzs)
      if (c.amount_uzs !== undefined) return s + Number(c.amount_uzs)
      return s + Math.round(amt)
    }
    return s + (Number(c.amount_uzs ?? amt) || 0)
  }, 0)

  const totalBerilganUZS = state.credits.filter(c => c.type === 'berilgan').reduce((s, c) => {
    const amt = Number(c.amount || 0)
    const cur = (c.currency || 'UZS')
    if (cur === 'USD') {
      if (usdToUzs) return s + Math.round(amt * usdToUzs)
      if (c.amount_uzs !== undefined) return s + Number(c.amount_uzs)
      return s + Math.round(amt)
    }
    return s + (Number(c.amount_uzs ?? amt) || 0)
  }, 0)

  // Net should exclude credits per requirement
  const netUzs = warehouseValueUzs + storeValueUzs
  // compute USD equivalents if rate available
  const warehouseValueUsd = usdToUzs && usdToUzs > 0 ? Number((warehouseValueUzs / usdToUzs).toFixed(2)) : null
  const storeValueUsd = usdToUzs && usdToUzs > 0 ? Number((storeValueUzs / usdToUzs).toFixed(2)) : null
  const netUsd = usdToUzs && usdToUzs > 0 ? Number((netUzs / usdToUzs).toFixed(2)) : null

  // group credits by currency for display (keeps existing behaviour)
  const creditsByCurrency = state.credits.reduce((acc, c) => { const cur = c.currency || 'UZS'; acc[cur] = acc[cur] || 0; acc[cur] += Number(c.amount || 0); return acc }, {})

  return (
    <Box sx={{ display: 'flex', justifyContent: 'start', alignItems:'center' }}>
  <Box sx={{ width: '100%', px: { xs: 2, sm: 2, md: 0 } }}>
      <Typography variant="h4" gutterBottom>Hisob</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography>Ombordagi jami qiymat</Typography>
              <Typography variant="h6">{displayCurrency === 'UZS' ? `${formatMoney(warehouseValueUzs)} UZS` : (warehouseValueUsd !== null ? `${formatMoney(warehouseValueUsd)} USD` : `${formatMoney(warehouseValueUzs)} UZS`)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography>Do'kondagi jami qiymat</Typography>
              <Typography variant="h6">{displayCurrency === 'UZS' ? `${formatMoney(storeValueUzs)} UZS` : (storeValueUsd !== null ? `${formatMoney(storeValueUsd)} USD` : `${formatMoney(storeValueUzs)} UZS`)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography>Olingan nasiyalar jami</Typography>
              <Typography variant="h6">{displayCurrency === 'UZS' ? `${formatMoney(totalOlinganUZS)} UZS` : (usdToUzs ? `${formatMoney(Number((totalOlinganUZS / usdToUzs).toFixed(2)))} USD` : `${formatMoney(totalOlinganUZS)} UZS`)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography>Berilgan nasiyalar jami</Typography>
              <Typography variant="h6">{displayCurrency === 'UZS' ? `${formatMoney(totalBerilganUZS)} UZS` : (usdToUzs ? `${formatMoney(Number((totalBerilganUZS / usdToUzs).toFixed(2)))} USD` : `${formatMoney(totalBerilganUZS)} UZS`)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography>Net balans</Typography>
              <Typography variant="h6">{displayCurrency === 'UZS' ? `${formatMoney(netUzs)} UZS` : (netUsd !== null ? `${formatMoney(netUsd)} USD` : `${formatMoney(netUzs)} UZS`)}</Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>Kreditlar alohida ko'rsatildi</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </Box>
    </Box>
  )
}
