import React from 'react';
import {
  Typography,
  Card,
  CardContent,
  Grid,
  Box,
  Alert,
  CardActionArea,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
} from '@mui/material';
import { formatMoney } from '../utils/format';
import { useApp } from '../context/useApp';
import useExchangeRate from '../hooks/useExchangeRate';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../hooks/useAuth';
import useDisplayCurrency from '../hooks/useDisplayCurrency';
import { convertFromBaseUzs, normalizeToBaseUzs, calculateInventoryTotal } from '../utils/currencyUtils';
import { formatProductName } from '../utils/productDisplay';
import { isMeterCategory } from '../utils/productCategories';

export default function Accounts() {
  const { state } = useApp();
  const { rate: usdToUzs } = useExchangeRate();
  const { t } = useLocale();
  const { user } = useAuth();
  const { displayCurrency, formatForDisplay } = useDisplayCurrency();
  const [detailState, setDetailState] = React.useState({
    open: false,
    rows: [],
    title: '',
    kind: 'inventory',
  });

  // Check if current user is restricted - if so, prevent access to this page
  const isRestricted = user?.permissions?.new_account_restriction ?? false;
  if (isRestricted) {
    return (
      <Box sx={{ width: '100%', px: { xs: 2, sm: 3 }, py: 4 }}>
        <Alert severity="error">
          {t('new_account_restriction_message') || "Yangi qo'shilgan akkauntlar bu sahifaga kira olmaydi"}
        </Alert>
      </Box>
    );
  }

  const warehouseTotals = React.useMemo(
    () => calculateInventoryTotal(state.warehouse, [], displayCurrency, usdToUzs),
    [state.warehouse, displayCurrency, usdToUzs]
  );

  const storeTotals = React.useMemo(
    () => calculateInventoryTotal([], state.store, displayCurrency, usdToUzs),
    [state.store, displayCurrency, usdToUzs]
  );

  const totalInventoryValue = convertFromBaseUzs(
    (warehouseTotals.totalUzs || 0) + (storeTotals.totalUzs || 0),
    displayCurrency,
    usdToUzs
  );

  const creditSum = React.useCallback(
    (predicate) =>
      (state.credits || [])
        .filter((c) => predicate(c))
        .reduce((sum, c) => {
          const remainingRaw =
            c.remaining != null ? Number(c.remaining) : Number(c.amount || 0) - Number(c.bosh_toluv || 0);
          const remaining = Math.max(0, remainingRaw);
          const base =
            c.amount_uzs != null ? Number(c.amount_uzs) : normalizeToBaseUzs(remaining, c.currency, usdToUzs);
          return sum + base;
        }, 0),
    [state.credits, usdToUzs]
  );

  const totalDebts = convertFromBaseUzs(
    creditSum((c) => getCreditDirection(c) === 'olingan' && !c.completed),
    displayCurrency,
    usdToUzs
  );

  const totalReceivables = convertFromBaseUzs(
    creditSum((c) => getCreditDirection(c) === 'berilgan' && !c.completed),
    displayCurrency,
    usdToUzs
  );

  function getCreditDirection(credit) {
    const raw = (
      credit?.credit_direction ||
      credit?.credit_subtype ||
      credit?.direction ||
      credit?.type ||
      ''
    ).toString().toLowerCase();
    if (!raw) return '';
    if (raw.includes('ber')) return 'berilgan';
    if (raw.includes('ol')) return 'olingan';
    return raw;
  }

  const buildRows = React.useCallback(
    (items, locationLabel) =>
      (items || []).map((item) => {
        const isMeter = isMeterCategory(item);
        const packQty = Number(item.pack_qty || 0);
        const qty = Number(item.qty || 0);
        const meterQty = isMeter ? Number(item.meter_qty ?? (packQty > 0 ? packQty * qty : 0)) : null;
        const pieces = isMeter && packQty > 0 ? Math.ceil((meterQty || 0) / packQty) : qty;

        const sizeBits = [];
        if (item.electrode_size) sizeBits.push(item.electrode_size);
        if (item.stone_thickness) sizeBits.push(item.stone_thickness);
        if (item.stone_size) sizeBits.push(item.stone_size);
        if (isMeter && packQty > 0) sizeBits.push(`${packQty} m/${t('dona')}`);

        const priceMain = isMeter
          ? `${formatForDisplay(item.price, item.currency)} ${displayCurrency} / m`
          : `${formatForDisplay(item.price, item.currency)} ${displayCurrency}`;
        const pricePiece =
          isMeter && item.price_piece !== undefined && item.price_piece !== null && item.price_piece !== ''
            ? `${formatForDisplay(item.price_piece, item.currency)} ${displayCurrency} / ${t('dona')}`
            : null;

        return {
          id: item.id || `${item.name || ''}-${item.category || ''}`,
          name: formatProductName(item, t) || item.name || '-',
          category: item.category || '-',
          size: sizeBits.length ? sizeBits.join(' | ') : '-',
          meter: isMeter ? `${meterQty || 0} m` : '-',
          qty: `${pieces || 0} ${t('dona')}`,
          priceMain,
          pricePiece,
          location: locationLabel,
        };
      }),
    [displayCurrency, formatForDisplay, t]
  );

  const buildCreditRows = React.useCallback(
    (items) =>
      (items || []).map((c) => {
        const dir = getCreditDirection(c);
        const isMeter = isMeterCategory(c);
        const packQty = Number(c.pack_qty || 0);
        const qty = Number(c.qty ?? c.quantity ?? 1);
        const meterQty = isMeter ? Number(c.meter_qty ?? (packQty > 0 ? packQty * qty : 0)) : null;
        const unitPrice = Number(c.unit_price ?? c.price ?? c.amount ?? 0);
        const amount = Number(c.amount ?? qty * unitPrice);
        const paid = Number(c.bosh_toluv ?? 0);
        const remaining = c.remaining !== undefined ? Number(c.remaining) : Math.max(0, amount - paid);

        const amountDisplay = normalizeToBaseUzs(amount, c.currency, usdToUzs);
        const remainingDisplay = normalizeToBaseUzs(remaining, c.currency, usdToUzs);

        const downPaymentOrig = Number(c.bosh_toluv_original ?? c.bosh_toluv ?? 0);
        const downPaymentCurrency = (c.bosh_toluv_currency || c.currency || 'UZS').toUpperCase();

        const date = c.date || (c.created_at ? c.created_at.slice(0, 10) : '');
        const time = c.time || '';

        return {
          id: c.id || `${c.name || ''}-${date}`,
          client: c.name || c.client_name || '-',
          product: c.product_name || c.productName || '-',
          category: c.category || c.product_category || '-',
          qty: qty || '-',
          meter: meterQty != null ? meterQty : '-',
          unitPrice: `${formatMoney(unitPrice)} ${c.currency || 'UZS'}`,
          amount: `${formatMoney(amount)} ${c.currency || 'UZS'}`,
          amountBase: `${formatMoney(amountDisplay)} ${displayCurrency}`,
          downPayment: `${formatMoney(downPaymentOrig)} ${downPaymentCurrency}`,
          remaining: `${formatMoney(remaining)} ${c.currency || 'UZS'}`,
          remainingBase: `${formatMoney(remainingDisplay)} ${displayCurrency}`,
          currency: c.currency || 'UZS',
          size: c.electrode_size || c.size || '-',
          thickness: c.stone_thickness || '-',
          stoneSize: c.stone_size || '-',
          packQty: packQty || '-',
          status: c.completed ? t('completed') : t('active_status'),
          direction: dir === 'berilgan' ? t('creditDirectionBerish') : t('creditDirectionOlingan'),
          date: `${date}${time ? ` ${time}` : ''}`,
        };
      }),
    [displayCurrency, t, usdToUzs]
  );

  const openDetails = React.useCallback(
    (source) => {
      if (source === 'store') {
        setDetailState({
          open: true,
          rows: buildRows(state.store, t('store')),
          title: t('store_inventory_details'),
          kind: 'inventory',
        });
        return;
      }
      if (source === 'warehouse') {
        setDetailState({
          open: true,
          rows: buildRows(state.warehouse, t('warehouse')),
          title: t('warehouse_inventory_details'),
          kind: 'inventory',
        });
        return;
      }
      if (source === 'receivables') {
        const credits = (state.credits || []).filter((c) => getCreditDirection(c) === 'berilgan');
        setDetailState({
          open: true,
          rows: buildCreditRows(credits),
          title: t('credit_given_details'),
          kind: 'credits',
        });
        return;
      }
      if (source === 'debts') {
        const credits = (state.credits || []).filter((c) => getCreditDirection(c) === 'olingan');
        setDetailState({
          open: true,
          rows: buildCreditRows(credits),
          title: t('credit_taken_details'),
          kind: 'credits',
        });
        return;
      }
      setDetailState({
        open: true,
        rows: [...buildRows(state.store, t('store')), ...buildRows(state.warehouse, t('warehouse'))],
        title: t('all_inventory_details'),
        kind: 'inventory',
      });
    },
    [buildRows, buildCreditRows, state.store, state.warehouse, state.credits, t]
  );

  const closeDetails = () =>
    setDetailState((prev) => ({
      ...prev,
      open: false,
    }));

  const SummaryCard = ({ title, value, onClick }) => {
    const clickable = typeof onClick === 'function';
    const content = (
      <CardContent>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" component="div">
          {formatMoney(value)} {displayCurrency}
        </Typography>
        {clickable && (
          <Typography variant="caption" color="text.secondary">
            {t('inventory_click_hint')}
          </Typography>
        )}
      </CardContent>
    );

    return (
      <Grid item xs={12} sm={6} md={4}>
        <Card sx={{ height: '100%' }}>
          {clickable ? (
            <CardActionArea sx={{ height: '100%' }} onClick={onClick}>
              {content}
            </CardActionArea>
          ) : (
            content
          )}
        </Card>
      </Grid>
    );
  };

  const DetailDialog = () => (
    <Dialog
      open={detailState.open}
      onClose={closeDetails}
      fullScreen
      fullWidth
      maxWidth="xl"
      PaperProps={{ sx: { width: '100%', height: '100%' } }}
    >
      <DialogTitle>{detailState.title}</DialogTitle>
      <DialogContent sx={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', pb: 2 }}>
        {detailState.rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {detailState.kind === 'credits' ? t('no_credits') : t('no_products')}
          </Typography>
        ) : (
          <TableContainer component={Paper} sx={{ mt: 1 }}>
            {detailState.kind === 'credits' ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('client') || t('clientNameLabel')}</TableCell>
                    <TableCell>{t('product')}</TableCell>
                    <TableCell>{t('category')}</TableCell>
                    <TableCell>{t('qty')}</TableCell>
                    <TableCell>{t('length_meter')}</TableCell>
                    <TableCell>{t('size')}</TableCell>
                    <TableCell>{t('unit_price')}</TableCell>
                    <TableCell>{t('amount')}</TableCell>
                    <TableCell>{t('amount')} ({displayCurrency})</TableCell>
                    <TableCell>{t('boshToluv')}</TableCell>
                    <TableCell>{t('remaining')}</TableCell>
                    <TableCell>{t('remaining')} ({displayCurrency})</TableCell>
                    <TableCell>{t('currency')}</TableCell>
                    <TableCell>{t('date')}</TableCell>
                    <TableCell>{t('status')}</TableCell>
                    <TableCell>{t('type')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailState.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.client}</TableCell>
                      <TableCell>{row.product}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.qty}</TableCell>
                      <TableCell>{row.meter}</TableCell>
                      <TableCell>{row.size || row.thickness || row.stoneSize || '-'}</TableCell>
                      <TableCell>{row.unitPrice}</TableCell>
                      <TableCell>{row.amount}</TableCell>
                      <TableCell>{row.amountBase}</TableCell>
                      <TableCell>{row.downPayment}</TableCell>
                      <TableCell>{row.remaining}</TableCell>
                      <TableCell>{row.remainingBase}</TableCell>
                      <TableCell>{row.currency}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell>{row.direction}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('productName')}</TableCell>
                    <TableCell>{t('category')}</TableCell>
                    <TableCell>{t('size')}</TableCell>
                    <TableCell>{t('length_meter')}</TableCell>
                    <TableCell>{t('qty')}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{t('price')}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {displayCurrency}
                      </Typography>
                    </TableCell>
                    <TableCell>{t('location')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailState.rows.map((row) => (
                    <TableRow key={`${row.id}-${row.location}`}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {row.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.size}</TableCell>
                      <TableCell>{row.meter}</TableCell>
                      <TableCell>{row.qty}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.priceMain}</Typography>
                        {row.pricePiece && (
                          <Typography variant="caption" color="text.secondary">
                            {row.pricePiece}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{row.location}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={closeDetails}>{t('close')}</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ width: '100%', px: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom>
        {t('accounts_summary')}
      </Typography>
      <Grid container spacing={3}>
        <SummaryCard
          title={t('total_receivables')}
          value={totalReceivables}
          onClick={() => openDetails('receivables')}
        />
        <SummaryCard
          title={t('total_debts')}
          value={totalDebts}
          onClick={() => openDetails('debts')}
        />
        <SummaryCard
          title={t('store_inventory_value')}
          value={storeTotals.totalInDisplay || 0}
          onClick={() => openDetails('store')}
        />
        <SummaryCard
          title={t('warehouse_inventory_value')}
          value={warehouseTotals.totalInDisplay || 0}
          onClick={() => openDetails('warehouse')}
        />
        <SummaryCard
          title={t('total_inventory_value')}
          value={totalInventoryValue}
          onClick={() => openDetails('all')}
        />
      </Grid>
      <DetailDialog />
    </Box>
  );
}
