import React from 'react';
import { Typography, Card, CardContent, Grid, Box } from '@mui/material';
import { formatWithSpaces } from '../utils/format';
import { useApp } from '../context/useApp';
import useExchangeRate from '../hooks/useExchangeRate';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../hooks/useAuth';

export default function Accounts() {
  const { state } = useApp();
  const { rate: usdToUzs } = useExchangeRate();
  const { t } = useLocale();
  const { user } = useAuth();

  // Calculate warehouse value in UZS
  const warehouseValueUzs = state.warehouse.reduce((sum, item) => {
    const qty = Number(item.qty || 0);
    let price = Number(item.price || 0);
    if (item.currency === 'USD') {
      price = usdToUzs ? price * usdToUzs : 0;
    }
    return sum + qty * price;
  }, 0);

  // Calculate store value in UZS
  const storeValueUzs = state.store.reduce((sum, item) => {
    const qty = Number(item.qty || 0);
    let price = Number(item.price || 0);
    if (item.currency === 'USD') {
      price = usdToUzs ? price * usdToUzs : 0;
    }
    return sum + qty * price;
  }, 0);

  // Total inventory value
  const totalInventoryValueUzs = warehouseValueUzs + storeValueUzs;

  // Calculate total debts (olingan nasiyalar)
  const totalDebtsUzs = state.credits
    .filter(c => c.credit_subtype === 'olingan' && !c.completed)
    .reduce((sum, c) => {
      const amount = Number(c.amount || 0);
      if (c.currency === 'USD') {
        return sum + Math.round(c.amount_uzs || (usdToUzs ? amount * usdToUzs : amount));
      }
      return sum + amount;
    }, 0);

  // Calculate total receivables (berilgan nasiyalar)
  const totalReceivablesUzs = state.credits
    .filter(c => c.credit_subtype === 'berilgan' && !c.completed)
    .reduce((sum, c) => {
      const amount = Number(c.amount || 0);
      if (c.currency === 'USD') {
        return sum + Math.round(c.amount_uzs || (usdToUzs ? amount * usdToUzs : amount));
      }
      return sum + amount;
    }, 0);

  const SummaryCard = ({ title, value }) => (
    <Grid item xs={12} sm={6} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {formatWithSpaces(value)} UZS
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
        <SummaryCard title={t('total_receivables')} value={totalReceivablesUzs} />
        <SummaryCard title={t('total_debts')} value={totalDebtsUzs} />
        <SummaryCard title={t('store_inventory_value')} value={storeValueUzs} />
        <SummaryCard title={t('warehouse_inventory_value')} value={warehouseValueUzs} />
        <SummaryCard title={t('total_inventory_value')} value={totalInventoryValueUzs} />
      </Grid>
    </Box>
  );
}