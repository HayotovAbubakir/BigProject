import React from 'react';
import { Typography, Card, CardContent, Grid, Box, Alert } from '@mui/material';
import { formatMoney } from '../utils/format';
import { useApp } from '../context/useApp';
import useExchangeRate from '../hooks/useExchangeRate';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../hooks/useAuth';
import useDisplayCurrency from '../hooks/useDisplayCurrency';
import { convertFromBaseUzs, normalizeToBaseUzs, calculateInventoryTotal } from '../utils/currencyUtils';

export default function Accounts() {
  const { state } = useApp();
  const { rate: usdToUzs } = useExchangeRate();
  const { t } = useLocale();
  const { user } = useAuth();
  const { displayCurrency } = useDisplayCurrency();

  // Check if current user is restricted - if so, prevent access to this page
  const isRestricted = user?.permissions?.new_account_restriction ?? false;
  if (isRestricted) {
    return (
      <Box sx={{ width: '100%', px: { xs: 2, sm: 3 }, py: 4 }}>
        <Alert severity="error">
          {t('new_account_restriction_message') || 'Yangi qo\'shilgan akkauntlar bu sahifaga kira olmaydi'}
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
      state.credits
        .filter(c => predicate(c))
        .reduce((sum, c) => {
          const base = c.amount_uzs != null
            ? Number(c.amount_uzs)
            : normalizeToBaseUzs(c.amount, c.currency, usdToUzs);
          return sum + base;
        }, 0),
    [state.credits, usdToUzs]
  );

  const totalDebts = convertFromBaseUzs(
    creditSum(c => c.credit_subtype === 'olingan' && !c.completed),
    displayCurrency,
    usdToUzs
  );

  const totalReceivables = convertFromBaseUzs(
    creditSum(c => c.credit_subtype === 'berilgan' && !c.completed),
    displayCurrency,
    usdToUzs
  );

  const SummaryCard = ({ title, value }) => (
    <Grid item xs={12} sm={6} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {formatMoney(value)} {displayCurrency}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <Box sx={{ width: '100%', px: { xs: 2, sm: 3 } }}>
      <Typography variant="h4" gutterBottom>
        {t('accounts_summary')}
      </Typography>
      <Grid container spacing={3}>
        <SummaryCard title={t('total_receivables')} value={totalReceivables} />
        <SummaryCard title={t('total_debts')} value={totalDebts} />
        <SummaryCard title={t('store_inventory_value')} value={storeTotals.totalInDisplay || 0} />
        <SummaryCard title={t('warehouse_inventory_value')} value={warehouseTotals.totalInDisplay || 0} />
        <SummaryCard title={t('total_inventory_value')} value={totalInventoryValue} />
      </Grid>
    </Box>
  );
}
