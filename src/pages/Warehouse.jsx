import React, { useState } from 'react'
import { Typography, Card, CardContent, Button, Table, TableHead, TableRow, TableCell, TableBody, Snackbar, TableContainer, Box, Grid, TextField } from '@mui/material'
import { formatMoney, parseNumber } from '../utils/format'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SellIcon from '@mui/icons-material/PointOfSale'
import MoveToStoreIcon from '@mui/icons-material/LocalShipping'
import MoveToStoreForm from '../components/MoveToStoreForm'
import WarehouseSellForm from '../components/WarehouseSellForm'
import useExchangeRate from '../hooks/useExchangeRate'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useLocale } from '../context/LocaleContext'
import useDisplayCurrency from '../hooks/useDisplayCurrency'
import WarehouseForm from '../components/WarehouseForm'
import ConfirmDialog from '../components/ConfirmDialog'
import WholesaleSale from '../components/WholesaleSale'

export default function Warehouse() {
  const { state, dispatch } = useApp()
  const [search, setSearch] = useState('')
  const [openForm, setOpenForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [moveItem, setMoveItem] = useState(null)
  const [sellItem, setSellItem] = useState(null)
  const [openWholesale, setOpenWholesale] = useState(false)
  const [confirm, setConfirm] = useState({ open: false, id: null })
  const [snack, setSnack] = useState({ open: false, text: '' })

  const { user } = useAuth()
  const { t } = useLocale()

  const { rate: usdToUzs } = useExchangeRate()
  const { displayCurrency, formatForDisplay } = useDisplayCurrency()
  const acctWh = state.accounts?.find(a => a.username === (user?.username || '').toLowerCase())
  const canWholesale = acctWh ? !!acctWh.permissions?.wholesale_allowed : true
  const canAddProducts = acctWh ? !!acctWh.permissions?.add_products : true

  const add = (payload) => {
    const amount = Number(payload.qty) * parseNumber(payload.cost || 0)
  dispatch({ type: 'ADD_WAREHOUSE', payload, log: { date: payload.date || new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: "Mahsulot qo'shildi", kind: 'ADD', productId: payload.id, productName: payload.name, qty: Number(payload.qty), unitPrice: parseNumber(payload.cost || 0), amount, currency: payload.currency || 'UZS', detail: `${payload.name} qo'shildi.` } })
  setSnack({ open: true, text: t('product_added') })
  }

  const edit = (payload) => {
  dispatch({ type: 'EDIT_WAREHOUSE', payload: { id: payload.id, updates: payload }, log: { date: payload.date || new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: 'Mahsulot tahrirlandi', kind: 'EDIT', productId: payload.id, productName: payload.name, qty: Number(payload.qty), unitPrice: parseNumber(payload.cost || 0), currency: payload.currency || 'UZS', detail: `${payload.name} tahrirlandi.` } })
    setSnack({ open: true, text: t('product_updated') })
  }

  const remove = (id) => {
  dispatch({ type: 'DELETE_WAREHOUSE', payload: { id }, log: { date: new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: "Mahsulot o'chirildi", kind: 'DELETE', productId: id, productName: id, detail: `Mahsulot ${id} o'chirildi.` } })
    setSnack({ open: true, text: t('product_deleted') })
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'start', alignItems:'center' }}>
  <Box sx={{ width: '100%', px: { xs: 2, sm: 2, md: 0 } }}>
      <Typography variant="h4" gutterBottom>{t('warehouse')}</Typography>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
            <Button variant="contained" onClick={() => { console.log('Warehouse + clicked'); setEditItem(null); setOpenForm(true) }} sx={{ minWidth: 40, px: 1 }} aria-label="add" disabled={!canAddProducts}>+</Button>
            {canWholesale ? (
              <Button variant="outlined" onClick={() => setOpenWholesale(true)}>{t('wholesale_sale')}</Button>
            ) : (
              <Button variant="outlined" disabled>{t('wholesale_sale')}</Button>
            )}
            <TextField size="small" placeholder={t('search_item') || 'Search...'} value={search} onChange={(e) => setSearch(e.target.value)} sx={{ ml: 'auto' }} />
          </Box> 

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
              {state.warehouse.filter(it => !search || (it.name || '').toLowerCase().includes(search.toLowerCase())).map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.name}</TableCell>
                  <TableCell sx={{ width: 80, textAlign: 'center' }}>{it.qty}</TableCell>
                  <TableCell sx={{ width: 120, textAlign: 'right' }}>
                    {(() => {
                      const displayed = formatForDisplay(it.cost, it.currency)
                      return (
                        <div>
                          {displayed !== null ? `${formatMoney(displayed)} ${displayCurrency}` : ''}
                          {displayCurrency !== it.currency ? (
                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>{`${formatMoney(it.cost)} ${it.currency}`}</div>
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
                      <Button onClick={() => setSellItem(it)} size="small" color="primary"><SellIcon /></Button>
                      <Button onClick={() => setMoveItem(it)} size="small" color="info"><MoveToStoreIcon /></Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Grid container spacing={2}>
              {state.warehouse.map(it => (
                <Grid item xs={12} sm={6} key={it.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>{it.name}</Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('total_count', { count: it.qty })}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontWeight: 700 }}>{it.currency === 'USD' ? `${formatMoney(it.cost)} USD` : `${formatMoney(it.cost)} UZS`}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                        <Button onClick={() => { setEditItem(it); setOpenForm(true) }} size="small" disabled={!canAddProducts}><EditIcon /></Button>
                        <Button onClick={() => setConfirm({ open: true, id: it.id })} size="small" color="error" disabled={!canAddProducts}><DeleteIcon /></Button>
                        <Button onClick={() => setSellItem(it)} size="small" color="primary"><SellIcon /></Button>
                        <Button onClick={() => setMoveItem(it)} size="small" color="info"><MoveToStoreIcon /></Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </CardContent>
      </Card>

      <WarehouseForm open={openForm} onClose={() => setOpenForm(false)} initial={editItem} onSubmit={(p) => editItem ? edit(p) : add(p)} />
        <MoveToStoreForm open={!!moveItem} initial={moveItem} onClose={() => setMoveItem(null)} onSubmit={(payload) => {
        const itemPrice = parseNumber(payload.item.price || 0)
        const amount = Number(payload.qty) * itemPrice
        const log = { date: new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: "Ombordan do'konga o'tkazish", kind: 'MOVE', productId: payload.item.id, productName: payload.item.name, qty: Number(payload.qty), unitPrice: parseNumber(payload.item.price || payload.item.cost || 0), amount, currency: payload.item.currency || 'UZS', detail: `${payload.item.name} ${payload.qty} ta ombordan do'konga o'tkazildi` }
        try {
                if ((payload.item.currency || 'UZS') === 'USD') {
                  if (usdToUzs) log.total_uzs = Math.round(amount * usdToUzs)
                  else if (payload.item.price_uzs) log.total_uzs = Math.round(Number(payload.item.price_uzs) * Number(payload.qty))
                } else {
                  log.total_uzs = Math.round(amount)
                }
        } catch (err) { void err }
    dispatch({ type: 'MOVE_TO_STORE', payload, log })
          }} />
      <WarehouseSellForm open={!!sellItem} initial={sellItem} onClose={() => setSellItem(null)} onSubmit={(payload) => {
  const unitPrice = parseNumber(payload.price || 0)
  const amount = Number(payload.qty) * unitPrice
  const log = { date: new Date().toISOString().slice(0,10), time: new Date().toLocaleTimeString(), user: user?.username || 'Admin', action: 'Mahsulot sotildi (ombor)', kind: 'SELL', productId: payload.id, productName: sellItem?.name || '', qty: Number(payload.qty), unitPrice, amount, currency: sellItem?.currency || 'UZS', detail: `${sellItem?.name || ''} sotildi ${payload.qty} dona` }
  log.source = 'warehouse'
  try {
    if ((sellItem?.currency || 'UZS') === 'USD') {
      if (payload.total_uzs) log.total_uzs = payload.total_uzs
      else if (usdToUzs) log.total_uzs = Math.round(amount * usdToUzs)
    } else {
      log.total_uzs = Math.round(amount)
    }
    } catch (err) { void err }
  dispatch({ type: 'SELL_WAREHOUSE', payload: { id: payload.id, qty: payload.qty }, log })
      }} />
      <ConfirmDialog open={confirm.open} onClose={() => setConfirm({ open:false, id: null })} title={t('confirm_delete_title')} onConfirm={() => remove(confirm.id)}>
        {t('confirm_delete_body')}
      </ConfirmDialog>
  <WholesaleSale open={openWholesale} onClose={() => setOpenWholesale(false)} source="warehouse" />
      <Snackbar open={snack.open} autoHideDuration={3000} message={snack.text} onClose={() => setSnack({ open:false, text: '' })} />
      </Box>
    </Box>
  )
}
