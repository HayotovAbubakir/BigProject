import React, { useState } from 'react'
import { Typography, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, Button, Snackbar, TableContainer, Box, Grid, TextField } from '@mui/material'
import { formatMoney, parseNumber } from '../utils/format'
import useExchangeRate from '../hooks/useExchangeRate'
import useDisplayCurrency from '../hooks/useDisplayCurrency'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import StoreForm from '../components/StoreForm'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import SellIcon from '@mui/icons-material/PointOfSale'
import SellForm from '../components/SellForm'
import SalesHistory from '../components/SalesHistory'
import HistoryIcon from '@mui/icons-material/History'
import ConfirmDialog from '../components/ConfirmDialog'
import WholesaleSale from '../components/WholesaleSale'

export default function Store() {
  const { state, dispatch } = useApp()
  const [search, setSearch] = useState('')
  // sellItem handled via local state when needed
  const [openForm, setOpenForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [snack, setSnack] = useState({ open: false, text: '' })
  const [confirm, setConfirm] = useState({ open: false, id: null })
  const [historyFor, setHistoryFor] = useState(null)

  const { user } = useAuth()
  const { t } = useLocale()
  const [sellItemLocal, setSellItemLocal] = useState(null)
  const { rate: usdToUzs } = useExchangeRate()
  const { displayCurrency, formatForDisplay } = useDisplayCurrency()
  const [openWholesale, setOpenWholesale] = useState(false)

  // determine wholesale permission from accounts in app state
  const acctStore = state.accounts?.find(a => a.username === (user?.username || '').toLowerCase())
  const canWholesale = acctStore ? !!acctStore.permissions?.wholesale_allowed : true
  const canAddProducts = acctStore ? !!acctStore.permissions?.add_products : true

  const handleSell = ({ id, qty }) => {
    const item = state.store.find(s => s.id === id)
  const price = parseNumber(item?.price || 0)
  const amount = Number(qty) * price
  const log = { date: new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: 'Mahsulot sotildi', kind: 'SELL', productId: id, productName: item?.name || id, qty, unitPrice: price, amount, currency: item?.currency || 'UZS', detail: `Mahsulot ${item?.name || id} dan ${qty} ta sotildi`, source: 'store' }
    // attach UZS total when possible so dashboard can aggregate in UZS
    try {
      if ((item?.currency || 'UZS') === 'USD') {
        if (usdToUzs) {
          log.total_uzs = Math.round(amount * usdToUzs)
        } else if (item.price_uzs) {
          log.total_uzs = Math.round(Number(item.price_uzs) * Number(qty))
        }
      } else {
        log.total_uzs = Math.round(amount)
      }
    } catch {
      // ignore
    }
    dispatch({ type: 'SELL_STORE', payload: { id, qty }, log })
    setSnack({ open: true, text: t('product_sold') })
  }

  const handleAddOrEdit = (payload) => {
    if (editItem) {
  const amount = Number(payload.qty) * parseNumber(payload.price || 0)
  dispatch({ type: 'DELETE_STORE', payload: { id: payload.id }, log: { date: new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: "Do'kon mahsuloti yangilandi", kind: 'EDIT', productId: payload.id, productName: payload.name, qty: Number(payload.qty), unitPrice: parseNumber(payload.price || 0), amount, currency: payload.currency || 'UZS', detail: `Mahsulot ${payload.name} yangilandi` } })
      // re-add updated
  dispatch({ type: 'ADD_STORE', payload, log: { date: new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: "Do'kon mahsuloti yangilandi", kind: 'ADD', productId: payload.id, productName: payload.name, qty: Number(payload.qty), unitPrice: parseNumber(payload.price || 0), amount, currency: payload.currency || 'UZS', detail: `Mahsulot ${payload.name} yangilandi` } })
    } else {
  const amount = Number(payload.qty) * parseNumber(payload.price || 0)
  dispatch({ type: 'ADD_STORE', payload, log: { date: new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: "Do'konga mahsulot qo'shildi", kind: 'ADD', productId: payload.id, productName: payload.name, qty: Number(payload.qty), unitPrice: parseNumber(payload.price || 0), amount, currency: payload.currency || 'UZS', detail: `Mahsulot ${payload.name} qo'shildi` } })
    }
    setSnack({ open: true, text: t('saved') })
  }

  const remove = (id) => {
    const it = state.store.find(s => s.id === id)
    const amount = Number(it?.qty || 0) * parseNumber(it?.price || 0)
    dispatch({ type: 'DELETE_STORE', payload: { id }, log: { date: new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: "Do'kon mahsuloti o'chirildi", kind: 'DELETE', productId: id, productName: it?.name || id, qty: Number(it?.qty || 0), unitPrice: parseNumber(it?.price || 0), amount, currency: it?.currency || 'UZS', detail: `Mahsulot ${it?.name || id} o'chirildi` } })
    setSnack({ open: true, text: t('deleted') })
    setConfirm({ open: false, id: null })
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'start', alignItems:'center' }}>
    <Box sx={{ width: '100%', px: { xs: 2, sm: 2, md: 0 } }}>
      <Typography variant="h4" gutterBottom>{t('store')}</Typography>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
            <Button variant="contained" onClick={() => { console.log('Store + clicked'); setEditItem(null); setOpenForm(true) }} sx={{ minWidth: 40, px: 1 }} aria-label="add" disabled={!canAddProducts}>+</Button>
            {canWholesale ? (
              <Button variant="outlined" onClick={() => setOpenWholesale(true)}>{t('wholesale_sale')}</Button>
            ) : (
              <Button variant="outlined" disabled>{t('wholesale_sale')}</Button>
            )}
            <TextField size="small" placeholder={t('search_item') || 'Search...'} value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ml: 'auto' }} />
          </Box>

          {/* Desktop/table view for larger screens */}
          <TableContainer sx={{ overflowX: 'auto', display: { xs: 'none', md: 'block' } }}>
            <Table sx={{ minWidth: 560 }}>
              <TableHead> 
              <TableRow>
                <TableCell>{t('name')}</TableCell>
                <TableCell sx={{ width: 80, textAlign: 'center' }}>{t('qty')}</TableCell>
                <TableCell sx={{ width: 120, textAlign: 'right' }}>{t('price')}</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{t('arrived_date')}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{t('note')}</TableCell>
                <TableCell sx={{ width: 120 }}>{t('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.store.filter(it => !search || (it.name || '').toLowerCase().includes(search.toLowerCase())).map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.name}</TableCell>
                  <TableCell sx={{ width: 80, textAlign: 'center' }}>{it.qty}</TableCell>
                  <TableCell sx={{ width: 160, textAlign: 'right' }}>
                    {(() => {
                      const displayed = formatForDisplay(it.price, it.currency)
                      return (
                        <div>
                          {displayed !== null ? `${formatMoney(displayed)} ${displayCurrency}` : ''}
                          {displayCurrency !== it.currency ? (
                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{`${formatMoney(it.price)} ${it.currency}`}</div>
                          ) : null}
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{it.date}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{it.note}</TableCell>
                  <TableCell sx={{ width: 120 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button onClick={() => { setEditItem(it); setOpenForm(true) }} size="small" disabled={!canAddProducts}><EditIcon /></Button>
                      <Button onClick={() => setConfirm({ open: true, id: it.id })} size="small" color="error" disabled={!canAddProducts}><DeleteIcon /></Button>
                      <Button onClick={() => setSellItemLocal(it)} size="small" color="primary"><SellIcon /></Button>
                      <Button onClick={() => setHistoryFor(it)} size="small" color="info"><HistoryIcon /></Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </TableContainer>

          {/* Mobile responsive card grid */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Grid container spacing={2}>
              {state.store.map(it => (
                <Grid item xs={12} sm={6} key={it.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>{it.name}</Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('total_count', { count: it.qty })}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontWeight: 700 }}>{it.currency === 'USD' ? `${formatMoney(it.price)} USD` : `${formatMoney(it.price)} UZS`}</Typography>
                          {it.currency === 'USD' && usdToUzs ? <Typography variant="caption" sx={{ color: 'text.secondary' }}>{formatMoney(Number(it.price) * usdToUzs)} UZS</Typography> : null}
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                        <Button onClick={() => { setEditItem(it); setOpenForm(true) }} size="small" disabled={!canAddProducts}><EditIcon /></Button>
                        <Button onClick={() => setConfirm({ open: true, id: it.id })} size="small" color="error" disabled={!canAddProducts}><DeleteIcon /></Button>
                        <Button onClick={() => setSellItemLocal(it)} size="small" color="primary"><SellIcon /></Button>
                        <Button onClick={() => setHistoryFor(it)} size="small" color="info"><HistoryIcon /></Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </CardContent>
      </Card>

      <StoreForm open={openForm} onClose={() => setOpenForm(false)} initial={editItem} onSubmit={handleAddOrEdit} />
  <SellForm open={!!sellItemLocal} initial={sellItemLocal} onClose={() => setSellItemLocal(null)} onSubmit={(payload) => { handleSell(payload); setSellItemLocal(null) }} />
  <WholesaleSale open={openWholesale} onClose={() => setOpenWholesale(false)} source="store" />
      <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open:false, id: null })} title={t('confirm_delete_title')} onConfirm={() => remove(confirm.id)}>
        {t('confirm_delete_body')}
      </ConfirmDialog>
      <Snackbar open={snack.open} autoHideDuration={3000} message={snack.text} onClose={() => setSnack({ open:false, text: '' })} />
      <SalesHistory open={!!historyFor} onClose={() => setHistoryFor(null)} sells={state.logs.filter(l => l.kind === 'SELL' && String(l.productId) === String(historyFor?.id)).sort((a,b)=> (b.date||'').localeCompare(a.date||'') )} />
      </Box>
    </Box>
  )
}
