import React, { useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box, TextField, Button, Grid, IconButton, Table, TableBody, TableCell, TableHead, TableRow, useTheme, useMediaQuery, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import { useApp } from '../context/useApp'
import { formatMoney } from '../utils/format'

function toCSV(rows) {
  if (!rows || !rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const header = keys.map(esc).join(',')
  const lines = rows.map(r => keys.map(k => esc(r[k])).join(','))
  return [header, ...lines].join('\n')
}

export default function OmborActions() {
  const { state } = useApp()
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))

  const [search, setSearch] = useState('')
  const [source, setSource] = useState('all')
  const [period, setPeriod] = useState('7') 

  const filtered = useMemo(() => {
    const logs = state.logs || []
    const now = Date.now()
    const days = Number(period) || 7
    const cutoff = now - (days * 24 * 60 * 60 * 1000)
    return logs.filter(l => {
      
      const src = ((l.source || l.kind || l.action || '') + '').toLowerCase()
      if (source !== 'all') {
        if (!src.includes(String(source).toLowerCase())) return false
      }

      
      let entryTs = null
      if (l.ts) entryTs = Number(l.ts)
      else if (l.date) {
        const d = new Date(l.date)
        if (!Number.isNaN(d.getTime())) entryTs = d.getTime()
      } else if (l.time && l.date === undefined) {
        
        entryTs = null
      }
      if (entryTs && entryTs < cutoff) return false

      if (search) {
        const s = search.toLowerCase()
        const hay = ((l.productName || '') + ' ' + (l.detail || '') + ' ' + (l.userName || l.user || l.userId || '') + ' ' + (l.action || '')).toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    }).slice(0, 200)
  }, [state.logs, search, source, period])

  const getAmountDisplay = (l) => {
    
    const usdVal = l.total ?? l.amount ?? l.price ?? l.unitPrice
    if ((l.currency || '').toUpperCase() === 'USD') {
      return usdVal ? `${usdVal} $` : ''
    }
    const uzs = l.total_uzs ?? l.amount_uzs ?? l.total ?? l.amount ?? 0
    return formatMoney(uzs) + ' UZS'
  }

  const handleExport = () => {
    const rows = filtered.map(l => ({
      id: l.id,
      ts: new Date(l.ts || l.date || Date.now()).toISOString(),
      product: l.productName || l.detail || '',
      qty: l.qty || '',
      currency: l.currency || 'UZS',
      total_uzs: l.total_uzs ?? l.amount ?? '',
      source: l.source || l.kind || '',
      user: l.userName || l.userId || ''
    }))
    const csv = toCSV(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `actions_export_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 1 }}>
          <Button startIcon={<DownloadIcon/>} onClick={handleExport} size="small">CSV</Button>
        </Box>

        <Grid container spacing={1} sx={{ mb: 1 }}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField size="small" fullWidth placeholder="Qidirish: mahsulot, user..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="oa-source">Manba</InputLabel>
              <Select labelId="oa-source" label="Manba" value={source} onChange={(e) => setSource(e.target.value)}>
                <MenuItem value="all">Hammasi</MenuItem>
                <MenuItem value="warehouse">Ombor</MenuItem>
                <MenuItem value="store">Do'kon</MenuItem>
                <MenuItem value="sell">Sotish</MenuItem>
                <MenuItem value="receive">Kirim</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="oa-period">Davr</InputLabel>
              <Select labelId="oa-period" label="Davr" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <MenuItem value="1">Bugun</MenuItem>
                <MenuItem value="7">7 kun</MenuItem>
                <MenuItem value="30">30 kun</MenuItem>
                <MenuItem value="365">Yil</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {}
        {isXs ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filtered.map(l => (
              <Box key={l.id || `${l.ts}_${l.productName}`} sx={{ borderRadius: 1, p: 1, background: 'rgba(15,23,36,0.02)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 600 }}>{l.productName || l.detail || '—'}</Typography>
                  <Typography variant="caption">{new Date(l.ts || l.date || Date.now()).toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="body2">{l.qty ?? ''} • {l.source || l.kind || ''}</Typography>
                  <Typography variant="body2">{getAmountDisplay(l)}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">{l.userName || l.userId || ''}</Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Vaqt</TableCell>
                <TableCell>Mahsulot</TableCell>
                <TableCell>Miqdor</TableCell>
                <TableCell>Manba</TableCell>
                <TableCell>Foydalanuvchi</TableCell>
                <TableCell align="right">Summa</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id || `${l.ts}_${l.productName}`}>
                  <TableCell>{new Date(l.ts || l.date || Date.now()).toLocaleString()}</TableCell>
                  <TableCell>{l.productName || l.detail || '—'}</TableCell>
                  <TableCell>{l.qty ?? ''}</TableCell>
                  <TableCell>{l.source || l.kind || ''}</TableCell>
                  <TableCell>{l.userName || l.userId || ''}</TableCell>
                  <TableCell align="right">{getAmountDisplay(l)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
