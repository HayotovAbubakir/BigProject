import React, { memo, useCallback, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../context/LocaleContext'
import useExchangeRate from '../hooks/useExchangeRate'
import { deleteLogsForDate } from '../firebase/supabaseLogs'
import {
  buildWholesaleGroups,
  formatWholesaleNumber,
  parseWholesaleDetail,
  roundWholesaleUsd,
} from '../utils/wholesaleHistory'

function DailySalesByDate({ selectedDate: propDate, onDateChange }) {
  const { state, dispatch } = useApp()
  const { user, confirmPassword, isDeveloper } = useAuth()
  const { t } = useLocale()
  const { rate: usdToUzs } = useExchangeRate()
  const navigate = useNavigate()
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'))
  const today = new Date().toISOString().slice(0, 10)
  const [internalDate, setInternalDate] = useState(today)

  const selectedDate = propDate || internalDate
  const setSelectedDate = useCallback((value) => {
    if (onDateChange) onDateChange(value)
    else setInternalDate(value)
  }, [onDateChange])

  const salesForDate = useMemo(() => {
    return (state.logs || []).filter((log) => {
      if (!log) return false
      const kind = (log.kind || '').toString().toUpperCase()
      return kind === 'SELL' && (log.date || '').toString().slice(0, 10) === selectedDate
    })
  }, [state.logs, selectedDate])

  const wholesaleLogs = useMemo(
    () => salesForDate.filter((log) => (log.action || '').toLowerCase() === 'wholesale_sale'),
    [salesForDate],
  )

  const visibleSales = useMemo(
    () => salesForDate.filter((log) => (log.action || '').toLowerCase() !== 'wholesale_sale'),
    [salesForDate],
  )

  const wholesaleGroups = useMemo(
    () => buildWholesaleGroups(wholesaleLogs, usdToUzs),
    [wholesaleLogs, usdToUzs],
  )

  const totalUzs = useMemo(() => {
    return visibleSales.reduce((acc, log) => {
      const amountUzs = log.total_uzs
        ?? log.amount_uzs
        ?? (log.currency === 'USD'
          ? (log.amount ? Math.round(Number(log.amount) * Number(usdToUzs || 0)) : 0)
          : log.amount)
      return acc + (Number(amountUzs) || 0)
    }, 0)
  }, [visibleSales, usdToUzs])

  const emptySalesMessage = wholesaleLogs.length > 0
    ? (t('wholesaleOnlyNotice') || "Optom sotuvlarni ko'rish uchun tugmani bosing")
    : t('noSalesForDate')

  const productLabel = React.useCallback((log) => {
    const parsed = parseWholesaleDetail((log?.detail || '').toString())
    if (parsed) {
      const items = parsed.items || []
      const currency = items[0]?.currency || log?.currency || 'UZS'
      const total = items.reduce((acc, item) => acc + Number(item.line_total || item.amount || 0), 0)
      const count = items.length || 1
      return `${t('wholesale_sale') || 'Wholesale'} (${count}) • ${formatWholesaleNumber(total)} ${currency}`
    }
    return log?.productName || log?.product_name || log?.detail || '-'
  }, [t])

  const handleDeleteSales = async () => {
    try {
      const password = window.prompt(t('enterAdminPassword') || 'Enter admin password to confirm deletion')
      if (password === null) return

      if (!isDeveloper) {
        const verify = await confirmPassword(password)
        if (!verify || !verify.ok) {
          window.alert(t('incorrectPassword') || 'Incorrect password')
          return
        }
      }

      const count = salesForDate.length
      if (!window.confirm((t('confirmDeleteSales') || 'Are you sure you want to delete all sales for this date?') + ` (${count} items)`)) {
        return
      }

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
  }

  return (
    <Paper elevation={4} sx={{ p: 2, width: '100%' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          mb: 2,
          gap: 2,
          flexWrap: 'wrap',
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
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
            onChange={(event) => setSelectedDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: '100%', sm: 180 } }}
          />
          <Button variant="outlined" size="small" onClick={() => setSelectedDate(today)}>
            {t('today')}
          </Button>
          <Button
            variant="contained"
            size="small"
            disabled={wholesaleGroups.length === 0}
            onClick={() => navigate(`/wholesale-history?date=${selectedDate}`)}
          >
            Optom sotuvlar ({wholesaleGroups.length})
          </Button>
          <Button variant="contained" size="small" color="error" onClick={handleDeleteSales}>
            {t('delete') || 'Delete'}
          </Button>
        </Box>
      </Box>

      {isNarrow ? (
        <Grid container spacing={2}>
          {visibleSales.length === 0 ? (
            <Grid item xs={12}>
              <Typography align="center">{emptySalesMessage}</Typography>
            </Grid>
          ) : (
            visibleSales.map((log, index) => {
              const qty = Number(log.qty || 0)
              const amount = Number(log.amount || 0)
              const unit = log.unitPrice != null
                ? Number(log.unitPrice)
                : (qty ? amount / qty : null)

              return (
                <Grid item xs={12} key={`${log.productId || index}-${index}`}>
                  <Card sx={{ width: '100%' }}>
                    <CardContent sx={{ py: 1, px: 2 }}>
                      <Box sx={{ minWidth: 0, display: 'grid', gap: 0.5 }}>
                        <Typography
                          sx={{
                            fontWeight: 700,
                            wordBreak: 'break-word',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {productLabel(log)}
                        </Typography>

                        <Box sx={{ display: 'grid', gap: 0.25, fontSize: '0.85rem' }}>
                          <Typography variant="caption" color="text.secondary">
                            {t('date')}: <strong>{log.date} {log.time}</strong>
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('user')}: <strong>{log.user_display || log.user_full_name || log.user || log.user_name || t('unknown')}</strong>
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('client_label')}: <strong>{log.client_name || log.clientName || '-'}</strong>
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2">{t('qty')}: <strong>{log.qty != null ? formatWholesaleNumber(log.qty) : '-'}</strong></Typography>
                          <Typography variant="body2">
                            {t('unit_price')}: <strong>{unit != null ? (log.currency === 'USD' ? roundWholesaleUsd(unit) : `${formatWholesaleNumber(unit)} UZS`) : '-'}</strong>
                          </Typography>
                          <Typography variant="body2">
                            {t('amount')}: <strong>{log.currency === 'USD' ? `$${roundWholesaleUsd(amount)}` : `${formatWholesaleNumber(amount)} UZS`}</strong>
                          </Typography>
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
              )
            })
          )}
        </Grid>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table
            size="small"
            sx={{
              tableLayout: 'fixed',
              minWidth: 720,
              '& td, & th': { whiteSpace: 'nowrap' },
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
                visibleSales.map((log, index) => {
                  const qty = Number(log.qty || 0)
                  const rawAmount = Number(log.amount || 0)
                  const unit = log.unitPrice != null
                    ? Number(log.unitPrice)
                    : (qty ? rawAmount / qty : null)
                  const amountUzs = log.total_uzs
                    ?? log.amount_uzs
                    ?? (log.currency === 'USD' && usdToUzs ? Math.round(Number(log.amount || 0) * Number(usdToUzs)) : log.amount)

                  return (
                    <TableRow key={`${log.productId || index}-${index}`} hover>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.time || ''}</TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.user_display || log.user_full_name || log.user || log.user_name || t('unknown')}</TableCell>
                      <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{productLabel(log)}</TableCell>
                      <TableCell align="right">{log.qty != null ? formatWholesaleNumber(log.qty) : '-'}</TableCell>
                      <TableCell align="right">{unit != null ? (log.currency === 'USD' ? roundWholesaleUsd(unit) : `${formatWholesaleNumber(unit)} UZS`) : '-'}</TableCell>
                      <TableCell align="right">{log.amount != null ? (log.currency === 'USD' ? roundWholesaleUsd(log.amount) : `${formatWholesaleNumber(log.amount)} UZS`) : '-'}</TableCell>
                      <TableCell align="right">{amountUzs != null ? formatWholesaleNumber(amountUzs) : '-'}</TableCell>
                      <TableCell align="right">
                        {log.source ? (t(log.source) || log.source) : ((log.action && log.action.includes('ombor')) ? t('warehouse') : t('store'))}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Typography variant="subtitle1">{t('totalUzs', { amount: formatWholesaleNumber(totalUzs) })}</Typography>
      </Box>
    </Paper>
  )
}

export default memo(DailySalesByDate)
