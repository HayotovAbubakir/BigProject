import React from 'react'
import { Card, CardContent, Typography, Box, Table, TableHead, TableRow, TableCell, TableBody, useTheme, useMediaQuery, List, ListItem, ListItemText, Divider } from '@mui/material'
import { useLocale } from '../context/LocaleContext'
import { formatMoney } from '../utils/format'
import useExchangeRate from '../hooks/useExchangeRate'


export default function DailySalesReport({ logs = [] }) {
  const { rate: usdToUzs } = useExchangeRate()

  const sellLogs = React.useMemo(() => (logs || []).filter(l => {
    const kind = (l.kind || '').toString().toUpperCase()
    const action = (l.action || '').toString().toLowerCase()
    return kind === 'SELL' || action.includes('sot')
  }), [logs])

  const byDate = React.useMemo(() => {
    const m = {}
    sellLogs.forEach(l => {
      const d = (l.date || new Date().toISOString().slice(0,10))
      if (!m[d]) m[d] = []
      m[d].push(l)
    })
    
    return Object.keys(m).sort((a,b) => b.localeCompare(a)).map(date => ({ date, items: m[date] }))
  }, [sellLogs])

  
  const convertToUzs = (log) => {
    if (!log) return 0
    if (typeof log.total_uzs !== 'undefined' && log.total_uzs !== null) return Number(log.total_uzs)
    const amt = Number(log.amount || 0)
    const currency = (log.currency || 'UZS').toString().toUpperCase()
    if (!amt) return 0
    if (currency === 'UZS') return Math.round(amt)
    if (currency === 'USD') {
      if (usdToUzs) return Math.round(amt * Number(usdToUzs))
      return NaN
    }
    return Math.round(amt)
  }

  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))
  const { t } = useLocale()

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>{t('dailySales')}</Typography>
        {byDate.length === 0 ? (
          <Typography variant="body2" color="text.secondary">{t('noSales')}</Typography>
        ) : (
          byDate.map(block => {
            const dayTotal = block.items.reduce((s, it) => {
              const uzs = convertToUzs(it)
              return s + (Number.isNaN(uzs) ? 0 : uzs)
            }, 0)
            return (
              <Box key={block.date} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{block.date} — Jami: {formatMoney(dayTotal)} UZS</Typography>
                {isXs ? (
                  
                  <List disablePadding>
                    {block.items.map((it, idx) => (
                      <React.Fragment key={idx}>
                        <ListItem sx={{ py: 1 }}>
                          <ListItemText
                              primary={`${(it.productName || it.detail || '-').toString().slice(0, 40)}`}
                              secondary={`${(it.time ? `${it.date} ${it.time}` : it.date) || ''} • ${(it.qty ?? '-')}`}
                            />
                          <Box sx={{ ml: 2, textAlign: 'right' }}>
                              <Typography variant="body2">{it.amount ? `${it.amount} ${it.currency || 'UZS'}` : '-'}</Typography>
                              {}
                              { (it.qty && Number(it.qty) > 0) ? (
                                (() => {
                                  const qty = Number(it.qty || 0)
                                  const unitOrig = (typeof it.unitPrice !== 'undefined' && it.unitPrice !== null) ? Number(it.unitPrice) : (Number(it.amount || 0) / qty)
                                  const unitCurr = it.currency || 'UZS'
                                  const unitUzs = (() => {
                                    if (typeof it.total_uzs !== 'undefined' && it.total_uzs !== null) return Math.round(Number(it.total_uzs) / qty)
                                    if (unitCurr === 'USD' && usdToUzs) return Math.round(unitOrig * Number(usdToUzs))
                                    if (unitCurr === 'UZS') return Math.round(unitOrig)
                                    return NaN
                                  })()
                                  return (
                                    <>
                                      <Typography variant="caption">{formatMoney(unitOrig)} {unitCurr}</Typography>
                                      <Typography variant="caption" color="text.secondary">{Number.isNaN(unitUzs) ? '—' : ` • ${formatMoney(unitUzs)} UZS`}</Typography>
                                    </>
                                  )
                                })()
                              ) : null }
                          </Box>
                        </ListItem>
                        <Divider component="li" />
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ overflowX: 'auto', width: '100%' }}>
                    <Box sx={{ minWidth: 720 }}>
                      <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                        <TableHead>
                          <TableRow>
                    <TableCell>{t('sanaVaqt')}</TableCell>
                      <TableCell>{t('mahsulot')}</TableCell>
                      <TableCell>{t('miqdor')}</TableCell>
                      <TableCell>{t('unit_price')}</TableCell>
                      <TableCell>{t('manba')}</TableCell>
                      <TableCell>{t('kimSotdi')}</TableCell>
                      <TableCell>{t('tolov')}</TableCell>
                      <TableCell>{t('uzsConvert')}</TableCell>
                              </TableRow>
                        </TableHead>
                        <TableBody>
                            {block.items.map((it, idx) => {
                              const src = (it.action || '').toLowerCase().includes('ombor') ? 'Ombor' : "Do'kon"
                              const uzs = convertToUzs(it)
                              const qty = Number(it.qty || 0)
                              const unitOrig = (typeof it.unitPrice !== 'undefined' && it.unitPrice !== null) ? Number(it.unitPrice) : (qty > 0 ? (Number(it.amount || 0) / qty) : null)
                              const unitCurr = it.currency || 'UZS'
                              const unitUzs = (() => {
                                if (qty <= 0) return NaN
                                if (typeof it.total_uzs !== 'undefined' && it.total_uzs !== null) return Math.round(Number(it.total_uzs) / qty)
                                if (unitCurr === 'USD' && usdToUzs) return Math.round(unitOrig * Number(usdToUzs))
                                if (unitCurr === 'UZS') return Math.round(unitOrig)
                                return NaN
                              })()
                              return (
                                <TableRow key={idx}>
                                  <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{(it.time ? `${it.date} ${it.time}` : it.date) || ''}</TableCell>
                                  <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{(it.productName || it.detail || '-').toString().slice(0, 80)}</TableCell>
                                  <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.qty ?? '-'}</TableCell>
                                  <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                    {unitOrig != null ? (
                                      <>
                                        <div>{`${formatMoney(unitOrig)} ${unitCurr}`}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{Number.isNaN(unitUzs) ? '' : `${formatMoney(unitUzs)} UZS`}</div>
                                      </>
                                    ) : '-'}
                                  </TableCell>
                                  <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{src}</TableCell>
                                  <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{it.user || it.seller || '-'}</TableCell>
                                  <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{(it.amount ? `${it.amount} ${it.currency || 'UZS'}` : '-')}</TableCell>
                                  <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{Number.isNaN(uzs) ? '\u0000' : `${formatMoney(uzs)} UZS`}</TableCell>
                                </TableRow>
                              )
                            })}
                        </TableBody>
                      </Table>
                    </Box>
                  </Box>
                )}
              </Box>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
