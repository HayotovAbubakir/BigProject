import React, { useMemo, useState } from 'react'
import { Box, Typography, TextField, Table, TableHead, TableRow, TableCell, TableBody, Paper, Button, TableContainer, useTheme, useMediaQuery, Card, CardContent, Grid, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Divider, Tooltip } from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../context/LocaleContext'
import useExchangeRate from '../hooks/useExchangeRate'
import { deleteLogsForDate } from '../firebase/supabaseLogs'
import { isMeterCategory } from '../utils/productCategories'


function formatNumber(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function roundUsd(n) {
  if (n == null) return '0.00'
  return (Math.round(Number(n) * 100) / 100).toFixed(2)
}

const formatIntl = (n, digits = 0) => {
  const num = Number(n || 0)
  return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export default function DailySalesByDate({ selectedDate: propDate, onDateChange }) {
  const { state } = useApp()
  const { dispatch } = useApp()
  const { user, hasPermission, confirmPassword, isDeveloper } = useAuth()
  const { t } = useLocale()
  const today = new Date().toISOString().slice(0, 10)
  const [internalDate, setInternalDate] = useState(today)
  const selectedDate = propDate || internalDate
  const setSelectedDate = (d) => {
    if (onDateChange) onDateChange(d)
    else setInternalDate(d)
  }

  const salesForDate = useMemo(() => {
    if (!state || !Array.isArray(state.logs)) return []
    return state.logs.filter((l) => {
      if (!l) return false
      const kind = (l.kind || '').toString().toUpperCase()
      return kind === 'SELL' && (l.date || '').toString().slice(0, 10) === selectedDate
    })
  }, [state, selectedDate])

  const { rate: usdToUzs } = useExchangeRate()

  const wholesaleLogs = useMemo(() => {
    return salesForDate.filter((l) => (l.action || '').toLowerCase() === 'wholesale_sale')
  }, [salesForDate])

  const visibleSales = useMemo(() => {
    return salesForDate.filter((l) => (l.action || '').toLowerCase() !== 'wholesale_sale')
  }, [salesForDate])

  const totalUzs = useMemo(() => {
    return visibleSales.reduce((acc, l) => {
      
      const v = l.total_uzs ?? l.amount_uzs ?? (l.currency === 'USD' ? (l.amount ? Math.round(Number(l.amount) * (usdToUzs || 0)) : 0) : l.amount)
      return acc + (Number(v) || 0)
    }, 0)
  }, [visibleSales, usdToUzs])

  const [wholesaleOpen, setWholesaleOpen] = React.useState(false)
  const productLabel = React.useCallback((log) => {
    const rawDetail = (log?.detail || '').toString()
    if (rawDetail.startsWith('WHOLESALE_JSON:')) {
      try {
        const parsed = JSON.parse(rawDetail.replace('WHOLESALE_JSON:', ''))
        const items = parsed?.items || []
        const currency = items[0]?.currency || log?.currency || 'UZS'
        const total = items.reduce((acc, it) => acc + Number(it.line_total || it.amount || 0), 0)
        const count = items.length || 1
        const amountText = total ? total.toLocaleString('en-US') : '0'
        return `${t('wholesale_sale') || 'Wholesale'} (${count}) • ${amountText} ${currency}`
      } catch (e) {
        return t('wholesale_sale') || 'Wholesale'
      }
    }
    return log?.productName || log?.detail || '-'
  }, [t])

  const parseWholesaleDetail = (detail) => {
    if (!detail || typeof detail !== 'string') return null
    const prefix = 'WHOLESALE_JSON:'
    if (!detail.startsWith(prefix)) return null
    try {
      return JSON.parse(detail.slice(prefix.length))
    } catch (_err) {
      return null
    }
  }

  const wholesaleGroups = React.useMemo(() => {
    const groups = {}
    wholesaleLogs.forEach((l) => {
      const meta = parseWholesaleDetail(l.detail)
      if (!meta) return
      const key = meta.ts || l.ts || `${l.date}-${l.time}-${l.id}`
      if (!groups[key]) {
        groups[key] = {
          id: key,
          date: l.date,
          time: l.time,
          user: l.user_display || l.user_name || 'Noma\'lum',
          rate: meta.rate || usdToUzs || null,
          items: [],
          totalUsd: 0,
          totalUzs: 0,
        }
      }
      const rate = meta.rate || usdToUzs || 0
      const pushItem = (item) => {
        const lineTotal = Number(item.line_total || item.amount || 0)
        const lineUsd = item.currency === 'USD' ? lineTotal : (rate ? lineTotal / rate : 0)
        const lineUzs = item.currency === 'USD' ? Math.round(lineTotal * (rate || 0)) : lineTotal
        groups[key].items.push({ ...item, currency: item.currency || l.currency || 'UZS' })
        groups[key].totalUsd += lineUsd || 0
        groups[key].totalUzs += lineUzs || 0
      }

      if (Array.isArray(meta.items) && meta.items.length) {
        meta.items.forEach((it) => pushItem({ ...it, rate }))
      } else {
        pushItem(meta)
      }
    })
    return Object.values(groups)
  }, [wholesaleLogs, usdToUzs])

  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'))
  const emptySalesMessage = wholesaleLogs.length > 0
    ? (t('wholesaleOnlyNotice') || 'Optom sotuvlarni ko\'rish uchun tugmani bosing')
    : t('noSalesForDate')

  return (
    <Paper elevation={4} sx={{ p: 2, width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box>
          <Typography variant="h6">{t('dailySalesFor', { date: selectedDate })}</Typography>
          <Typography variant="body2" color="text.secondary">{t('dailySalesHint')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          <TextField
            label={t('selectDate')}
            type="date"
            size="small"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: '100%', sm: 180 } }}
          />
          <Button variant="outlined" size="small" onClick={() => setSelectedDate(today)} sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
            {t('today')}
          </Button>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="small"
              disabled={wholesaleGroups.length === 0}
              onClick={() => setWholesaleOpen(true)}
            >
              Optom sotuvlar ({wholesaleGroups.length})
            </Button>
            <Button
              variant="contained"
              size="small"
              color="error"
              onClick={async () => {
                try {
                  const pwd = window.prompt(t('enterAdminPassword') || 'Enter admin password to confirm deletion')
                  if (pwd === null) return
                  // developer bypasses local password check
                  if (!isDeveloper) {
                    const verify = await confirmPassword(pwd)
                    if (!verify || !verify.ok) {
                      window.alert(t('incorrectPassword') || 'Incorrect password')
                      return
                    }
                  }
                  const count = salesForDate.length
                  if (!window.confirm((t('confirmDeleteSales') || 'Are you sure you want to delete all sales for this date?') + ` (${count} items)`)) return
                  // delete from backend first so refresh won't restore
                  try {
                    await deleteLogsForDate(selectedDate)
                  } catch (err) {
                    console.warn('Remote delete failed, continuing with local delete', err)
                  }
                  dispatch({ type: 'DELETE_LOGS_FOR_DATE', payload: { date: selectedDate, user: user && user.username } })
                  window.alert(t('deletedSuccess') || 'Deleted')
                } catch (err) {
                  console.error('Delete logs error', err)
                  window.alert(t('deleteFailed') || 'Delete failed')
                }
              }}
              sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
            >
              {t('delete') || 'Delete'}
            </Button>
          </Box>
        </Box>
      </Box>

      {isNarrow ? (
        <Grid container spacing={2}>
          {visibleSales.length === 0 ? (
            <Grid item xs={12}>
              <Typography align="center">{emptySalesMessage}</Typography>
            </Grid>
          ) : (
            visibleSales.map((l, i) => (
              <Grid item xs={12} key={`${l.productId || i}-${i}`}>
                <Card sx={{ width: '100%', minHeight: 'fit-content' }}>
                  <CardContent sx={{ py: 1, px: 2 }}>
                    <Box sx={{ minWidth: 0, display: 'grid', gap: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {productLabel(l)}
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 0.25, fontSize: '0.85rem' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                          {t('client_label')}: <strong>{l.client_name || l.clientName || '-'}</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('product')}: <strong>{productLabel(l)}</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('date')}: <strong>{l.date} {l.time}</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('user')}: <strong>{l.user_display || l.user_full_name || l.user || l.user_name || t('unknown') || "Noma'lum"}</strong>
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{t('qty')}: <strong>{l.qty != null ? formatNumber(l.qty) : '-'}</strong></Typography>
                        {(() => {
                          const qty = Number(l.qty || 0)
                          const rawAmount = Number(l.amount || 0)
                          const unitFallback = qty ? (rawAmount / qty) : null
                          const unit = (l.unitPrice != null) ? Number(l.unitPrice) : unitFallback
                          return <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{t('unit_price')}: <strong>{unit != null ? (l.currency === 'USD' ? `${roundUsd(unit)}` : `${formatNumber(unit)} UZS`) : '-'}</strong></Typography>
                        })()}
                        {(() => {
                          if (l.amount != null) return <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{t('amount')}: <strong>{l.currency === 'USD' ? `${roundUsd(l.amount)}` : `${formatNumber(l.amount)} UZS`}</strong></Typography>
                          const qty = Number(l.qty || 0)
                          const unit = l.unitPrice != null ? Number(l.unitPrice) : (qty ? (Number(l.amount || 0) / qty) : null)
                          if (unit != null && qty) return <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{t('amount')}: <strong>{l.currency === 'USD' ? `$${roundUsd(unit * qty)}` : `${formatNumber(unit * qty)} UZS`}</strong></Typography>
                          return null
                        })()}
                        <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{t('source')}: <strong>{l.source ? (t(l.source) || l.source) : (l.action && l.action.includes('ombor') ? t('warehouse') : t('store'))}</strong></Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Tooltip title={t('actions')}>
                          <IconButton size="small">
                            <MoreHorizIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table
            size="small"
            sx={{
              tableLayout: 'fixed',
              minWidth: 720,
              '& td, & th': { whiteSpace: 'nowrap' }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 110 }}>{t('time')}</TableCell>
                <TableCell sx={{ width: 140 }}>{t('user')}</TableCell>
                <TableCell sx={{ width: 220 }}>{t('product')}</TableCell>
                <TableCell align="right">{t('qty')}</TableCell>
                <TableCell align="right">{t('unit_price')}</TableCell>
                <TableCell align="right">{t('amount')}</TableCell>
                <TableCell align="right">{t('amount_uzs')}</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>{t('source')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
  {visibleSales.length === 0 ? (
    <TableRow>
      <TableCell colSpan={8} align="center">{emptySalesMessage}</TableCell>
    </TableRow>
  ) : (
    visibleSales.map((l, i) => {
      const qty = Number(l.qty || 0)
      const rawAmount = Number(l.amount || 0)
      const unitFallback = qty ? (rawAmount / qty) : null
      const unit = (l.unitPrice != null) ? Number(l.unitPrice) : unitFallback
      const amountDisplay = l.amount != null
        ? (l.currency === 'USD' ? `${roundUsd(l.amount)}` : `${formatNumber(l.amount)} UZS`)
        : (unit != null && qty ? (l.currency === 'USD' ? `${roundUsd(unit * qty)}` : `${formatNumber(unit * qty)} UZS`) : '-')
      const unitDisplay = unit != null ? (l.currency === 'USD' ? `${roundUsd(unit)}` : `${formatNumber(unit)} UZS`) : '-'
      const amountUzs = l.total_uzs ?? l.amount_uzs ?? (l.currency === 'USD' && usdToUzs ? Math.round(Number(l.amount || 0) * Number(usdToUzs || 0)) : l.amount)
      const sourceDisplay = l.source ? (t(l.source) || l.source) : ((l.action && l.action.includes('ombor')) ? t('warehouse') : t('store'))
      return (
        <TableRow key={`${l.productId || i}-${i}`} hover>
          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.time || ''}</TableCell>
          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.user_display || l.user_full_name || l.user || l.user_name || t('unknown')}</TableCell>
          <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{productLabel(l)}</TableCell>
          <TableCell align="right">{l.qty != null ? formatNumber(l.qty) : '-'}</TableCell>
          <TableCell align="right">{unitDisplay}</TableCell>
          <TableCell align="right">{amountDisplay}</TableCell>
          <TableCell align="right">{amountUzs != null ? formatNumber(amountUzs) : '-'}</TableCell>
          <TableCell align="right">{sourceDisplay}</TableCell>
        </TableRow>
      )
    })
  )}
</TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Typography variant="subtitle1">{t('totalUzs', { amount: formatNumber(totalUzs) })}</Typography>
      </Box>

      <Dialog open={wholesaleOpen} onClose={() => setWholesaleOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Optom sotuvlar</DialogTitle>
        <DialogContent dividers>
          {wholesaleGroups.length === 0 ? (
            <Typography color="text.secondary">Optom sotuvlar yo'q</Typography>
          ) : (
            wholesaleGroups.map((g) => (
              <Box key={g.id} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>Sana/Vaqt: {g.date} {g.time}</Typography>
                    <Typography variant="body2" color="text.secondary">Sotuvchi: {g.user}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2">Jami (USD): {formatIntl(g.totalUsd, 2)}</Typography>
                    <Typography variant="body2">Jami (UZS): {formatIntl(g.totalUzs)} UZS</Typography>
                    {g.rate ? <Typography variant="body2">Kurs: 1 USD = {formatIntl(g.rate)} UZS</Typography> : null}
                  </Box>
                </Box>
                <TableContainer sx={{ mt: 1 }}>
                  <Table size="small" sx={{ '& td, & th': { fontSize: '0.85rem' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Mahsulot</TableCell>
                        <TableCell>Kategoriya</TableCell>
                        <TableCell align="right">Miqdor</TableCell>
                        <TableCell align="right">Narx</TableCell>
                        <TableCell align="right">Jami</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
  {g.items.map((it, idx) => {
    const isMeterCat = isMeterCategory(it)
    const qtyValue = isMeterCat && it.meter_qty != null ? it.meter_qty : (it.qty != null ? it.qty : null)
    const qtyUnit = isMeterCat ? (it.unit || 'metr') : (it.unit || 'dona')
    const qtyText = qtyValue != null ? `${formatIntl(qtyValue)} ${qtyUnit}` : '-'
    const unitPriceText = `${formatIntl(it.unit_price, it.currency === 'USD' ? 2 : 0)} ${it.currency || 'UZS'}`
    const lineTotalText = `${formatIntl(it.line_total, it.currency === 'USD' ? 2 : 0)} ${it.currency || 'UZS'}`
    return (
      <TableRow key={idx}>
        <TableCell>{it.product_name || it.name || '-'}</TableCell>
        <TableCell>{it.category || '-'}</TableCell>
        <TableCell align="right">{qtyText}</TableCell>
        <TableCell align="right">{unitPriceText}</TableCell>
        <TableCell align="right">{lineTotalText}</TableCell>
      </TableRow>
    )
  })}
</TableBody>
                  </Table>
                </TableContainer>
                <Divider sx={{ mt: 2 }} />
              </Box>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWholesaleOpen(false)}>Yopish</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}




