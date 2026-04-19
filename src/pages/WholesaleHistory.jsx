import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useApp } from '../context/useApp'
import useExchangeRate from '../hooks/useExchangeRate'
import { isMeterCategory } from '../utils/productCategories'
import {
  buildWholesaleGroups,
  formatWholesaleIntl,
  formatWholesaleNumber,
} from '../utils/wholesaleHistory'

const today = new Date().toISOString().slice(0, 10)

const buildItemMeta = (item) => {
  const parts = []
  if (item.category) parts.push(`Kategoriya: ${item.category}`)
  if (item.electrode_size) parts.push(`Razmer: ${item.electrode_size}`)
  if (item.stone_thickness) parts.push(`Qalinlik: ${item.stone_thickness}`)
  if (item.stone_size) parts.push(`Hajmi: ${item.stone_size}`)
  return parts
}

export default function WholesaleHistory() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { state } = useApp()
  const { rate: usdToUzs } = useExchangeRate()

  const selectedDate = searchParams.get('date') || today

  const wholesaleLogs = React.useMemo(() => {
    return (state.logs || []).filter((log) => {
      if (!log) return false
      const isWholesale = (log.action || '').toLowerCase() === 'wholesale_sale'
      return isWholesale && (log.date || '').toString().slice(0, 10) === selectedDate
    })
  }, [state.logs, selectedDate])

  const wholesaleGroups = React.useMemo(
    () => buildWholesaleGroups(wholesaleLogs, usdToUzs),
    [wholesaleLogs, usdToUzs],
  )

  const pageSummary = React.useMemo(() => {
    return wholesaleGroups.reduce(
      (acc, group) => {
        acc.sessions += 1
        acc.items += group.items.length
        acc.totalUsd += Number(group.totalUsd || 0)
        acc.totalUzs += Number(group.totalUzs || 0)
        return acc
      },
      { sessions: 0, items: 0, totalUsd: 0, totalUzs: 0 },
    )
  }, [wholesaleGroups])

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Button variant="text" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 1, px: 0 }}>
            Orqaga
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Optom sotuvlar
          </Typography>
          <Typography color="text.secondary">
            Sana bo'yicha barcha optom sessiyalar aniq jadval ko'rinishida.
          </Typography>
        </Box>

        <Box sx={{ minWidth: { xs: '100%', md: 220 } }}>
          <TextField
            fullWidth
            label="Sana"
            type="date"
            value={selectedDate}
            onChange={(event) => setSearchParams({ date: event.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Jami sessiyalar</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{pageSummary.sessions}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Jami mahsulot qatori</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{pageSummary.items}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Jami (USD)</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{formatWholesaleIntl(pageSummary.totalUsd, 2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Jami (UZS)</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>{formatWholesaleNumber(pageSummary.totalUzs)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {wholesaleGroups.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">Bu sana uchun optom sotuv topilmadi</Typography>
          <Typography color="text.secondary">
            Boshqa sana tanlang yoki yangi optom sotuv yarating.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {wholesaleGroups.map((group, groupIndex) => (
            <Paper key={group.id} variant="outlined" sx={{ p: 2.5, display: 'grid', gap: 2 }}>
              <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Sessiya #{wholesaleGroups.length - groupIndex}
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    Sana/Vaqt: {group.date} {group.time}
                  </Typography>
                  <Typography color="text.secondary">Sotuvchi: {group.user}</Typography>
                </Box>

                <Grid container spacing={1.5} sx={{ width: { xs: '100%', lg: 520 } }}>
                  <Grid item xs={12} sm={4}>
                    <Paper variant="outlined" sx={{ p: 1.25, height: '100%' }}>
                      <Typography variant="caption" color="text.secondary">Sessiya USD</Typography>
                      <Typography sx={{ fontWeight: 800 }}>{formatWholesaleIntl(group.totalUsd, 2)}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Paper variant="outlined" sx={{ p: 1.25, height: '100%' }}>
                      <Typography variant="caption" color="text.secondary">Sessiya UZS</Typography>
                      <Typography sx={{ fontWeight: 800 }}>{formatWholesaleNumber(group.totalUzs)} UZS</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Paper variant="outlined" sx={{ p: 1.25, height: '100%' }}>
                      <Typography variant="caption" color="text.secondary">Kurs</Typography>
                      <Typography sx={{ fontWeight: 800 }}>
                        {group.rate ? `1 USD = ${formatWholesaleNumber(group.rate)} UZS` : '-'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Stack>

              <TableContainer>
                <Table
                  size="small"
                  sx={{
                    tableLayout: 'fixed',
                    minWidth: 860,
                    '& th, & td': {
                      verticalAlign: 'top',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '34%' }}>Mahsulot ma'lumoti</TableCell>
                      <TableCell sx={{ width: '16%' }} align="right">Miqdor</TableCell>
                      <TableCell sx={{ width: '16%' }} align="right">Narx</TableCell>
                      <TableCell sx={{ width: '16%' }} align="right">Jami</TableCell>
                      <TableCell sx={{ width: '18%' }}>Manba</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.items.map((item, index) => {
                      const isMeterItem = isMeterCategory(item)
                      const quantityValue = isMeterItem && item.meter_sold != null
                        ? item.meter_sold
                        : (item.qty != null ? item.qty : 0)
                      const quantityText = `${formatWholesaleIntl(quantityValue)} ${item.unit || (isMeterItem ? 'metr' : 'dona')}`
                      const meta = buildItemMeta(item)

                      return (
                        <TableRow key={`${group.id}-${index}`} hover>
                          <TableCell>
                            <Typography sx={{ fontWeight: 800 }}>
                              {item.name || item.product_name || '-'}
                            </Typography>
                            {meta.length > 0 && (
                              <Stack spacing={0.25} sx={{ mt: 0.75 }}>
                                {meta.map((line) => (
                                  <Typography key={line} variant="caption" color="text.secondary">
                                    {line}
                                  </Typography>
                                ))}
                              </Stack>
                            )}
                          </TableCell>
                          <TableCell align="right">{quantityText}</TableCell>
                          <TableCell align="right">
                            {formatWholesaleIntl(item.unit_price, item.currency === 'USD' ? 2 : 0)} {item.currency || 'UZS'}
                          </TableCell>
                          <TableCell align="right">
                            {formatWholesaleIntl(item.line_total, item.currency === 'USD' ? 2 : 0)} {item.currency || 'UZS'}
                          </TableCell>
                          <TableCell>{item.source === 'warehouse' ? 'Ombor' : item.source === 'store' ? "Do'kon" : '-'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  )
}
