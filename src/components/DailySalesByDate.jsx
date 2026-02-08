import React, { useMemo, useState } from 'react'
import { Box, Typography, TextField, Table, TableHead, TableRow, TableCell, TableBody, Paper, Button, TableContainer, useTheme, useMediaQuery, Card, CardContent, Grid, IconButton } from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../context/LocaleContext'
import useExchangeRate from '../hooks/useExchangeRate'


function formatNumber(n) {
  if (n == null) return '0'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function roundUsd(n) {
  if (n == null) return '0.00'
  return (Math.round(Number(n) * 100) / 100).toFixed(2)
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

  const totalUzs = useMemo(() => {
    return salesForDate.reduce((acc, l) => {
      
      const v = l.total_uzs ?? l.amount_uzs ?? (l.currency === 'USD' ? (l.amount ? Math.round(Number(l.amount) * (usdToUzs || 0)) : 0) : l.amount)
      return acc + (Number(v) || 0)
    }, 0)
  }, [salesForDate, usdToUzs])

  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'))

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

      {isNarrow ? (
        <Grid container spacing={2}>
          {salesForDate.length === 0 ? (
            <Grid item xs={12}>
              <Typography align="center">{t('noSalesForDate')}</Typography>
            </Grid>
          ) : (
            salesForDate.map((l, i) => (
              <Grid item xs={12} key={`${l.productId || i}-${i}`}>
                <Card>
                  <CardContent sx={{ py: 1, px: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                          {l.productName || l.detail || '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                          {l.date} {l.time} • {l.user}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2">{t('qty')}: <strong>{l.qty ?? '-'}</strong></Typography>
                          {(() => {
                            
                            const qty = Number(l.qty || 0)
                            const rawAmount = Number(l.amount || 0)
                            const unitFallback = qty ? (rawAmount / qty) : null
                            const unit = (l.unitPrice != null) ? Number(l.unitPrice) : unitFallback
                            return <Typography variant="body2">{t('unit_price')}: <strong>{unit != null ? (l.currency === 'USD' ? `$${roundUsd(unit)}` : `${formatNumber(unit)} UZS`) : '-'}</strong></Typography>
                          })()}
                          {(() => {
                            
                            if (l.amount != null) return <Typography variant="body2">{t('amount')}: <strong>{l.currency === 'USD' ? `$${roundUsd(l.amount)}` : `${formatNumber(l.amount)} UZS`}</strong></Typography>
                            
                            const qty = Number(l.qty || 0)
                            const unit = l.unitPrice != null ? Number(l.unitPrice) : (qty ? (Number(l.amount || 0) / qty) : null)
                            if (unit != null && qty) return <Typography variant="body2">{t('amount')}: <strong>{l.currency === 'USD' ? `$${roundUsd(unit * qty)}` : `${formatNumber(unit * qty)} UZS`}</strong></Typography>
                            return null
                          })()}
                          <Typography variant="body2">{t('source')}: <strong>{l.source ? (t(l.source) || l.source) : (l.action && l.action.includes('ombor') ? t('warehouse') : t('store'))}</strong></Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'start' }}>
                        <IconButton size="small"><MoreHorizIcon /></IconButton>
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
          <Table size="small" sx={{ minWidth: 0 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('time')}</TableCell>
                <TableCell>{t('user')}</TableCell>
                <TableCell>{t('product')}</TableCell>
                <TableCell align="right">{t('qty')}</TableCell>
                <TableCell align="right">{t('unit_price')}</TableCell>
                <TableCell align="right">{t('amount')}</TableCell>
                <TableCell align="right">{t('amount_uzs')}</TableCell>
                <TableCell align="right">{t('source')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {salesForDate.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">{t('noSalesForDate')}</TableCell>
                </TableRow>
              ) : (
                salesForDate.map((l, i) => (
                  <TableRow key={`${l.productId || i}-${i}`} hover>
                    <TableCell>{l.time || ''}</TableCell>
                    <TableCell>{l.user || ''}</TableCell>
                    <TableCell>{l.productName || l.detail || ''}</TableCell>
                    <TableCell align="right">{l.qty ?? ''}</TableCell>
                    {(() => {
                      const qty = Number(l.qty || 0)
                      const rawAmount = Number(l.amount || 0)
                      const unitFallback = qty ? (rawAmount / qty) : null
                      const unit = (l.unitPrice != null) ? Number(l.unitPrice) : unitFallback
                      return <TableCell align="right">{unit != null ? (l.currency === 'USD' ? `$${roundUsd(unit)}` : `${formatNumber(unit)} UZS`) : ''}</TableCell>
                    })()}
                    {(() => {
                      if (l.amount != null) return <TableCell align="right">{l.currency === 'USD' ? `$${roundUsd(l.amount)}` : `${formatNumber(l.amount)} UZS`}</TableCell>
                      const qty = Number(l.qty || 0)
                      const unit = l.unitPrice != null ? Number(l.unitPrice) : (qty ? (Number(l.amount || 0) / qty) : null)
                      if (unit != null && qty) return <TableCell align="right">{l.currency === 'USD' ? `$${roundUsd(unit * qty)}` : `${formatNumber(unit * qty)} UZS`}</TableCell>
                      return <TableCell align="right"></TableCell>
                    })()}
                    <TableCell align="right">{formatNumber(l.total_uzs ?? l.amount_uzs ?? (l.currency === 'USD' && usdToUzs ? Math.round((l.amount || 0) * usdToUzs) : (l.currency === 'USD' ? (l.amount_uzs ?? 0) : l.amount)) ?? 0)} UZS</TableCell>
                    <TableCell align="right">{l.source ? (t(l.source) || l.source) : ''}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Typography variant="subtitle1">{t('totalUzs', { amount: formatNumber(totalUzs) })}</Typography>
      </Box>
    </Paper>
  )
}
