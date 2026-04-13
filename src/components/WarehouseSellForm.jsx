import React, { useState, useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, FormControl, InputLabel, Select, MenuItem, TextField, Stack } from '@mui/material'
import NumberField from './NumberField'
import CurrencyField from './CurrencyField'
import useExchangeRate from '../hooks/useExchangeRate'
import { formatMoney } from '../utils/format'
import { normalizeCategory, isMeterCategory } from '../utils/productCategories'
import { formatProductName } from '../utils/productDisplay'
import { useLocale } from '../context/LocaleContext'

export default function WarehouseSellForm({ open, onClose, onSubmit, initial }) {
  const { t } = useLocale()
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState(initial?.price ? Number(initial.price) : 0)
  const [currency, setCurrency] = useState(initial?.currency || 'UZS')
  const [unit, setUnit] = useState('dona')
  const [meterQty, setMeterQty] = useState('')
  
  const isElectrode = normalizeCategory(initial?.category) === 'elektrod'
  const isMeter = isMeterCategory(initial)
  const packQty = Number(initial?.pack_qty || 0)
  const meterPriceDefault = Number(initial?.price ?? 0)
  const piecePriceDefault = Number(initial?.price_piece ?? initial?.price ?? 0)
  const packPriceDefault = Number(initial?.price_pack ?? 0)
  const meterAvailable = isMeter ? Number(initial?.meter_qty ?? (Number(initial?.qty || 0) * packQty)) : 0
  const fullPacksAvailable = isMeter && packQty > 0 ? Math.floor(meterAvailable / packQty) : 0
  const openMetersAvailable = isMeter ? meterAvailable - (fullPacksAvailable * packQty) : 0
  const nameWithSize = initial ? formatProductName(initial) : ''

  useEffect(() => {
    if (initial) {
      setPrice(isMeter ? (meterPriceDefault > 0 ? meterPriceDefault : 0) : (piecePriceDefault > 0 ? piecePriceDefault : 0))
      setQty('')
      setUnit(isMeter ? 'metr' : 'dona')
      setCurrency(initial?.currency || 'UZS')
      setMeterQty('')
    }
  }, [initial, open, piecePriceDefault, meterPriceDefault, isMeter])

  useEffect(() => {
    if (isElectrode) {
      if (unit === 'pachka') {
        if (packPriceDefault > 0) setPrice(packPriceDefault)
      } else {
        if (piecePriceDefault > 0) setPrice(piecePriceDefault)
      }
      return
    }
    if (isMeter) {
      if (unit === 'metr') {
        if (meterPriceDefault > 0) setPrice(meterPriceDefault)
      } else if (piecePriceDefault > 0) {
        setPrice(piecePriceDefault)
      }
    }
  }, [unit, isElectrode, isMeter, packPriceDefault, piecePriceDefault, meterPriceDefault])

  const availablePieces = Number(initial?.qty || 0)
  const availablePacks = packQty > 0 ? Math.floor(availablePieces / packQty) : 0
  const available = isMeter
    ? (unit === 'metr' ? meterAvailable : fullPacksAvailable)
    : (isElectrode && unit === 'pachka' ? availablePacks : availablePieces)
  const inputQty = isMeter && unit === 'metr' ? Number(meterQty || 0) : Number(qty || 0)
  const parsedPrice = Number(price || 0)
  const qtyError = inputQty <= 0 || inputQty > available || ((unit === 'pachka' || (isMeter && unit === 'dona')) && packQty <= 0)
  const invalid = qtyError || parsedPrice <= 0
  const { rate: usdToUzs } = useExchangeRate()
  const totalValue = inputQty * parsedPrice

  const submit = () => {
    if (invalid) return
    const total = totalValue
    const usedRate = usdToUzs || null
    const meterSold = isMeter ? (unit === 'dona' ? inputQty * packQty : inputQty) : 0
    const deductQty = isMeter
      ? (unit === 'dona' ? inputQty : (packQty > 0 ? Math.ceil(meterSold / packQty) : 0))
      : (unit === 'pachka' ? inputQty * packQty : inputQty)
    const payload = { id: initial.id, qty: inputQty, deduct_qty: deductQty, price: parsedPrice, currency, unit, pack_qty: packQty, meter_qty: meterSold }
    if (currency === 'USD' && usedRate) {
      payload.price_uzs = Math.round(parsedPrice * usedRate)
      payload.total_uzs = Math.round(total * usedRate)
    } else {
      payload.total_uzs = Math.round(total)
    }
    onSubmit(payload)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { maxHeight: '90vh', overflow: 'hidden' } }}>
      <DialogTitle sx={{ fontSize: { xs: '0.95rem', md: '1.15rem' }, p: { xs: 1.5, md: 2 } }}>{t('sell_title') || t('sell')}</DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2 }, overflowY: 'auto', overflowX: 'hidden' }}>
        <Stack spacing={2}>
          <TextField label={t('product_label') || t('product')} fullWidth margin="dense" size="small" value={nameWithSize} disabled />
          {isMeter ? (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                {t('available_caption', { value: `${meterAvailable} m` }) || `${t('available')}: ${meterAvailable} m`}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                {t('available_full')}: {fullPacksAvailable} {t('unit_piece') || 'dona'}{openMetersAvailable > 0 ? ` | ${t('available_open')}: ${openMetersAvailable} m` : ''}
              </Typography>
              {packQty > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                  1 {t('unit_piece') || 'dona'}: {packQty} m
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
              {t('available')}: {availablePieces} {t('unit_piece') || 'dona'}{isElectrode ? ` (${availablePacks} ${t('unit_pack') || 'pachka'})` : ''}
            </Typography>
          )}
          {isElectrode && packQty > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
              {t('in_pack')}: {packQty} {t('unit_piece') || 'dona'}
            </Typography>
          )}

          {(isElectrode || isMeter) && (
            <FormControl fullWidth>
              <InputLabel id="wsell-unit-label" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>{t('unit') || 'Birlik'}</InputLabel>
              <Select
                labelId="wsell-unit-label"
                value={unit}
                label={t('unit') || 'Birlik'}
                onChange={(e) => setUnit(e.target.value)}
                size="small"
                MenuProps={{
                  disableScrollLock: true
                }}
              >
                {isMeter
                  ? [
                      <MenuItem key="metr" value="metr">{t('unit_meter') || 'Metr'}</MenuItem>,
                      <MenuItem key="dona" value="dona">{t('unit_piece') || 'Dona'}</MenuItem>,
                    ]
                  : [
                      <MenuItem key="dona" value="dona">{t('unit_piece') || 'Dona'}</MenuItem>,
                      <MenuItem key="pachka" value="pachka" disabled={packQty <= 0}>{t('unit_pack') || 'Pachka'}</MenuItem>,
                    ]}
              </Select>
            </FormControl>
          )}

          <NumberField
            label={
              isMeter
                ? (unit === 'metr' ? (t('unit_meter') || 'Metr') : (t('quantity_piece') || t('qty')))
                : (isElectrode ? `${t('qty')} (${unit === 'pachka' ? (t('unit_pack') || 'pachka') : (t('unit_piece') || 'dona')})` : (t('qty') || ''))
            }
            fullWidth
            margin="dense"
            value={isMeter && unit === 'metr' ? meterQty : qty}
            onChange={(v) => {
              if (isMeter && unit === 'metr') {
                setMeterQty(v === null ? '' : v)
              } else {
                setQty(v === null ? '' : v)
              }
            }}
            error={qtyError}
            helperText={qtyError ? (inputQty <= 0 ? t('min_value') : t('too_many')) : ''}
          />

          <FormControl fullWidth>
            <InputLabel id="wsell-currency-label" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>{t('currency_label') || t('currency')}</InputLabel>
            <Select labelId="wsell-currency-label" value={currency} label={t('currency_label') || t('currency')} onChange={(e) => setCurrency(e.target.value)} size="small">
              <MenuItem value="UZS">UZS</MenuItem>
              <MenuItem value="USD">USD</MenuItem>
            </Select>
          </FormControl>

          {isMeter && (
            <Box sx={{ display: 'flex', gap: 2, rowGap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.72rem', md: '0.8rem' } }}>
                {t('price_per_meter')}: {formatMoney(meterPriceDefault || 0)} {currency}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.72rem', md: '0.8rem' } }}>
                1 {t('unit_piece') || 'dona'}: {formatMoney(piecePriceDefault || 0)} {currency}
              </Typography>
            </Box>
          )}

          <CurrencyField
            label={
              isMeter
                ? (unit === 'metr' ? t('price_per_meter') : t('price_per_piece'))
                : (isElectrode ? `${t('price')} (${unit === 'pachka' ? (t('unit_pack') || 'pachka') : (t('unit_piece') || 'dona')})` : (t('price') || ''))
            }
            fullWidth
            margin="dense"
            value={price}
            onChange={(v) => setPrice(v)}
            currency={currency}
          />

          {currency === 'USD' ? (
            <Box>
              <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', md: '0.875rem' } }}>{t('total')}: {totalValue} USD</Typography>
              {usdToUzs ? <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>≈ {formatMoney(Math.round(totalValue * usdToUzs))} UZS</Typography> : <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>{t('no_rate')}</Typography>}
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>{t('total')}: {formatMoney(totalValue)} UZS</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 1, md: 2 }, py: { xs: 1.5, md: 2 }, gap: 1 }}>
        <Button onClick={onClose} sx={{ minWidth: { xs: 70, md: 100 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>{t('cancel')}</Button>
        <Button variant="contained" onClick={submit} disabled={invalid} sx={{ minWidth: { xs: 70, md: 120 }, fontSize: { xs: '0.75rem', md: '0.875rem' }, p: { xs: '6px 12px', md: '8px 16px' } }}>{t('sell')}</Button>
      </DialogActions>
    </Dialog>
  )
}
