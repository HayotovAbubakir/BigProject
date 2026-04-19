import React, { memo, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  useTheme,
  Box,
  TextField,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  ShowChart as ShowChartIcon,
  CalendarToday as CalendarTodayIcon,
} from '@mui/icons-material';
import ReactApexChart from 'react-apexcharts';

import { useApp } from '../context/useApp';
import useExchangeRate from '../hooks/useExchangeRate';
import useDisplayCurrency from '../hooks/useDisplayCurrency';
import { formatMoney } from '../utils/format';
import { monthShortFromISO } from '../utils/date';
import { useLocale } from '../context/LocaleContext';
import DailySalesByDate from '../components/DailySalesByDate';
import {
  normalizeToBaseUzs,
  convertFromBaseUzs,
  calculateCreditTotals,
} from '../utils/currencyUtils';

const ChartCard = memo(function ChartCard({ title, icon, children }) {
  return (
    <Card sx={{ height: '100%', minHeight: 'fit-content', width: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {icon}
          <Typography variant="h6" component="div" sx={{ ml: 1, fontSize: { xs: '1rem', md: '1.05rem' } }}>
            {title}
          </Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
});

function Dashboard() {
  const { state } = useApp();
  const { t, locale } = useLocale();
  const theme = useTheme();
  const { rate: usdToUzs } = useExchangeRate();
  const { displayCurrency } = useDisplayCurrency();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [period, setPeriod] = useState('overall');

  const logs = useMemo(() => state.logs || [], [state.logs]);
  const warehouse = state.warehouse || [];
  const store = state.store || [];
  const accounts = state.accounts || [];
  const credits = state.credits || [];

  const allProducts = useMemo(() => [...warehouse, ...store], [warehouse, store]);
  const productMap = useMemo(() => new Map(allProducts.map((product) => [product.id, product])), [allProducts]);
  const sellLogs = useMemo(
    () => logs.filter((log) => log && log.kind === 'SELL'),
    [logs],
  );

  const monthlyAnalysisData = useMemo(() => {
    const monthlyMap = new Map();

    sellLogs.forEach((log) => {
      const amountInUzs = normalizeToBaseUzs(log.amount, log.currency, usdToUzs);
      const month = monthShortFromISO(log.date);
      const current = monthlyMap.get(month) || { month, sold: 0 };
      current.sold += amountInUzs;
      monthlyMap.set(month, current);
    });

    return Array.from(monthlyMap.values())
      .sort((a, b) => new Date(`${a.month}-01-2000`) - new Date(`${b.month}-01-2000`))
      .map((item) => ({
        month: item.month,
        sold: convertFromBaseUzs(item.sold, displayCurrency, usdToUzs),
      }));
  }, [sellLogs, displayCurrency, usdToUzs]);

  const periodFilteredSellLogs = useMemo(() => {
    if (period === 'overall') return sellLogs;

    if (period === 'daily') {
      return sellLogs.filter((log) => log.date === selectedDate);
    }

    if (period === 'weekly') {
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return sellLogs.filter((log) => {
        const logDate = new Date(log.date);
        return logDate >= startOfWeek && logDate <= endOfWeek;
      });
    }

    if (period === 'monthly') {
      const monthPrefix = selectedDate.slice(0, 7);
      return sellLogs.filter((log) => log.date.startsWith(monthPrefix));
    }

    if (period === 'yearly') {
      const yearPrefix = selectedDate.slice(0, 4);
      return sellLogs.filter((log) => log.date.startsWith(yearPrefix));
    }

    return sellLogs;
  }, [sellLogs, period, selectedDate]);

  const topSoldProducts = useMemo(() => {
    const productQty = {};

    const addProductQty = (name, qty, meta = {}) => {
      const safeQty = Number(qty) || 0;
      if (!name || Number.isNaN(safeQty)) return;

      if (!productQty[name]) {
        productQty[name] = { qty: 0, meta };
      }

      productQty[name].qty += safeQty;
      productQty[name].meta = { ...productQty[name].meta, ...meta };
    };

    const toPieces = (qty, unit, packQty, productId) => {
      const resolvedPackQty = Number(packQty || productMap.get(productId)?.pack_qty || 0);
      const unitLower = (unit || '').toString().toLowerCase();
      if (unitLower === 'metr' && resolvedPackQty > 0) {
        return Math.ceil(Number(qty || 0) / resolvedPackQty);
      }
      return Number(qty || 0);
    };

    periodFilteredSellLogs.forEach((log) => {
      const action = (log.action || '').toLowerCase();
      if (action === 'wholesale_sale') {
        try {
          const detailString = log.detail || '';
          const parsed = detailString.startsWith('WHOLESALE_JSON:')
            ? JSON.parse(detailString.replace('WHOLESALE_JSON:', ''))
            : null;
          const items = parsed?.items || [];

          items.forEach((item) => {
            const name = item.name || item.id || 'Unknown';
            const qtyPieces = toPieces(
              item.unit === 'metr' ? (item.meter_sold ?? item.qty) : item.qty,
              item.unit,
              item.pack_qty,
              item.id,
            );

            addProductQty(name, qtyPieces, {
              category: item.category,
              size: item.electrode_size || item.stone_size || '',
              thickness: item.stone_thickness || '',
              volume: item.stone_volume || item.stone_hajmi || item.volume || '',
              packQty: item.pack_qty,
              isMeter: item.unit === 'metr' || item.isMeter,
            });
          });
        } catch (error) {
          console.warn('Failed to parse wholesale detail for top products', error);
        }
        return;
      }

      let name = log.productName || log.product_name;
      const product = productMap.get(log.productId || log.product_id);
      if (!name && product) {
        name = product.name;
      }

      addProductQty(name || 'Unknown', toPieces(log.qty, log.unit, log.pack_qty, log.productId || log.product_id), {
        category: product?.category,
        size: product?.electrode_size || product?.stone_size || '',
        thickness: product?.stone_thickness || '',
        volume: product?.stone_volume || product?.stone_hajmi || product?.volume || '',
        packQty: product?.pack_qty,
        isMeter: product ? !!product.meter_qty || Number(product.pack_qty) > 0 : false,
      });
    });

    allProducts.forEach((product) => {
      const name = product.name || product.title || product.id || 'Unknown';
      if (productQty[name]) return;
      productQty[name] = {
        qty: 0,
        meta: {
          category: product.category,
          size: product.electrode_size || product.stone_size || '',
          thickness: product.stone_thickness || '',
          volume: product.stone_volume || product.stone_hajmi || product.volume || '',
          packQty: product.pack_qty,
          isMeter: !!product.meter_qty || !!product.pack_qty,
        },
      };
    });

    const sorted = Object.entries(productQty).sort(([, a], [, b]) => b.qty - a.qty);
    while (sorted.length < 5) {
      sorted.push([`- ${sorted.length + 1}`, { qty: 0, meta: {} }]);
    }
    return sorted.slice(0, 5);
  }, [allProducts, periodFilteredSellLogs, productMap]);

  const selectedDaySales = useMemo(
    () => sellLogs.filter((log) => log.date === selectedDate),
    [sellLogs, selectedDate],
  );

  const accountByUsername = useMemo(() => {
    const map = new Map();
    accounts.forEach((account) => {
      map.set((account.username || '').toString().toLowerCase(), account);
    });
    return map;
  }, [accounts]);

  const dailySalesByAccount = useMemo(() => {
    const accountSales = {};
    let grandTotalUzs = 0;
    let grandTotalUsd = 0;

    selectedDaySales.forEach((log) => {
      const username = log.user || log.user_name || 'Unknown';
      const account = accountByUsername.get((username || '').toString().toLowerCase());
      const userLabel = account ? (account.label || account.username || username) : username;

      if (!accountSales[userLabel]) {
        accountSales[userLabel] = { usd: 0, uzs: 0, totalUzs: 0 };
      }

      const currency = (log.currency || 'UZS').toUpperCase();
      const amount = Number(log.amount) || 0;

      if (currency === 'USD') {
        accountSales[userLabel].usd += amount;
        grandTotalUsd += amount;
        if (usdToUzs && usdToUzs > 0) {
          const amountInUzs = Math.round(amount * usdToUzs);
          accountSales[userLabel].totalUzs += amountInUzs;
          grandTotalUzs += amountInUzs;
        }
      } else {
        accountSales[userLabel].uzs += amount;
        accountSales[userLabel].totalUzs += amount;
        grandTotalUzs += amount;
      }
    });

    const percentBase = displayCurrency === 'USD'
      ? grandTotalUsd + (grandTotalUzs > 0 && usdToUzs > 0 ? convertFromBaseUzs(grandTotalUzs, 'USD', usdToUzs) : 0)
      : grandTotalUzs + (grandTotalUsd > 0 && usdToUzs > 0 ? Math.round(grandTotalUsd * usdToUzs) : 0);

    const accountsWithTotals = Object.entries(accountSales).map(([user, totals]) => {
      const displayValue = displayCurrency === 'USD'
        ? totals.usd + (totals.uzs > 0 && usdToUzs > 0 ? convertFromBaseUzs(totals.uzs, 'USD', usdToUzs) : 0)
        : totals.uzs + (totals.usd > 0 && usdToUzs > 0 ? Math.round(totals.usd * usdToUzs) : 0);

      return {
        user,
        usd: totals.usd,
        uzs: totals.uzs,
        totalUzs: totals.totalUzs,
        displayValue,
        percent: percentBase > 0 ? Number(((displayValue / percentBase) * 100).toFixed(1)) : 0,
      };
    });

    const displayTotal = displayCurrency === 'USD'
      ? grandTotalUsd + (grandTotalUzs > 0 && usdToUzs > 0 ? convertFromBaseUzs(grandTotalUzs, 'USD', usdToUzs) : 0)
      : grandTotalUzs + (grandTotalUsd > 0 && usdToUzs > 0 ? Math.round(grandTotalUsd * usdToUzs) : 0);

    return {
      accounts: accountsWithTotals,
      totalUsd: grandTotalUsd,
      totalUzs: grandTotalUzs,
      displayTotal,
    };
  }, [selectedDaySales, accountByUsername, usdToUzs, displayCurrency]);

  const creditsSummary = useMemo(() => {
    const direction = (credit) => (credit?.credit_direction || credit?.type || '').toString().toLowerCase();
    const givenCredits = credits.filter((credit) => direction(credit) === 'berilgan');
    const receivedCredits = credits.filter((credit) => direction(credit) === 'olingan');
    const completedCredits = credits.filter((credit) => credit.completed);

    const givenTotal = calculateCreditTotals(givenCredits, displayCurrency, usdToUzs, 'all');
    const receivedTotal = calculateCreditTotals(receivedCredits, displayCurrency, usdToUzs, 'all');
    const completedTotal = calculateCreditTotals(completedCredits, displayCurrency, usdToUzs, 'all');

    return {
      given: givenTotal.total,
      received: receivedTotal.total,
      completed: completedTotal.total,
    };
  }, [credits, displayCurrency, usdToUzs]);

  const chartBaseOptions = useMemo(() => ({
    chart: {
      animations: {
        speed: 250,
        animateGradually: { enabled: true, delay: 80 },
      },
      toolbar: { show: false },
      parentHeightOffset: 0,
    },
    stroke: { curve: 'smooth', width: 3 },
    markers: { size: 0 },
    xaxis: {
      labels: { style: { colors: theme.palette.text.secondary } },
    },
    yaxis: {
      labels: {
        style: { colors: theme.palette.text.secondary },
        formatter: (value) => formatMoney(value),
      },
    },
    tooltip: {
      theme: theme.palette.mode,
      y: { formatter: (value) => `${formatMoney(value)} ${displayCurrency === 'USD' ? '$' : 'UZS'}` },
    },
    legend: { labels: { colors: theme.palette.text.primary } },
    grid: { borderColor: theme.palette.divider },
  }), [theme, displayCurrency]);

  const monthlySeries = useMemo(
    () => [{ name: t('sold'), data: monthlyAnalysisData.map((item) => item.sold) }],
    [monthlyAnalysisData, t],
  );

  const monthlyChartOptions = useMemo(() => ({
    ...chartBaseOptions,
    colors: [theme.palette.primary.main, theme.palette.secondary.main],
    xaxis: { ...chartBaseOptions.xaxis, categories: monthlyAnalysisData.map((item) => item.month) },
  }), [chartBaseOptions, monthlyAnalysisData, theme]);

  const topSoldCategories = useMemo(() => {
    return topSoldProducts.map(([name, data]) => {
      const { category, size, thickness, volume, packQty, isMeter } = data.meta || {};
      const parts = [];
      if (category) parts.push(category);
      if (size) parts.push(size);
      if (thickness) parts.push(thickness);
      if (volume) parts.push(volume);
      if (isMeter && packQty) parts.push(`${packQty}m/dona`);
      return parts.length ? `${name} (${parts.join(' • ')})` : name;
    });
  }, [topSoldProducts]);

  const topSoldSeries = useMemo(
    () => [{ name: t('quantity_sold'), data: topSoldProducts.map(([, data]) => data.qty) }],
    [topSoldProducts, t],
  );

  const topSoldOptions = useMemo(() => ({
    ...chartBaseOptions,
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '50%',
        borderRadius: 4,
        distributed: true,
        dataLabels: { position: 'bottom' },
      },
    },
    colors: [
      theme.palette.primary.light,
      theme.palette.secondary.light,
      theme.palette.error.light,
      theme.palette.warning.light,
      theme.palette.success.light,
    ],
    dataLabels: {
      enabled: true,
      textAnchor: 'start',
      style: {
        colors: [theme.palette.text.primary],
      },
      formatter: (value, options) => `${options.w.globals.labels[options.dataPointIndex]}: ${value}`,
      offsetX: 0,
      dropShadow: { enabled: true },
    },
    xaxis: {
      ...chartBaseOptions.xaxis,
      categories: topSoldCategories,
    },
    yaxis: { labels: { show: false } },
    grid: { ...chartBaseOptions.grid, show: false },
    legend: { show: false },
    tooltip: {
      theme: theme.palette.mode,
      y: {
        title: {
          formatter: (_seriesName, options) => options.w.globals.labels[options.dataPointIndex],
        },
      },
    },
  }), [chartBaseOptions, theme, topSoldCategories]);

  const dailyAccountSeries = useMemo(
    () => [{ name: t('percentage'), data: dailySalesByAccount.accounts.map((account) => account.percent) }],
    [dailySalesByAccount.accounts, t],
  );

  const dailyAccountOptions = useMemo(() => ({
    ...chartBaseOptions,
    xaxis: {
      ...chartBaseOptions.xaxis,
      categories: dailySalesByAccount.accounts.map((account) => account.user),
    },
    plotOptions: {
      bar: { horizontal: false, dataLabels: { position: 'top' } },
    },
    dataLabels: {
      enabled: true,
      formatter: (value, options) => {
        const account = dailySalesByAccount.accounts[options.dataPointIndex];
        const formattedValue = displayCurrency === 'USD'
          ? `$${formatMoney(account.displayValue)}`
          : `${formatMoney(account.displayValue)} UZS`;
        return `${formattedValue} (${value}%)`;
      },
      style: { colors: [theme.palette.text.primary], fontSize: '11px' },
    },
    tooltip: {
      ...chartBaseOptions.tooltip,
      y: {
        formatter: (value, options) => {
          const account = dailySalesByAccount.accounts[options.dataPointIndex];
          return `${displayCurrency === 'USD' ? `$${formatMoney(account.displayValue)}` : `${formatMoney(account.displayValue)} UZS`} (${value}%)`;
        },
      },
    },
  }), [chartBaseOptions, dailySalesByAccount.accounts, displayCurrency, theme]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('dashboard')}
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', gap: { xs: 1, md: 2 }, alignItems: 'center', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
        <TextField
          label={t('select_date') || 'Select Date'}
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{t('period')}</InputLabel>
          <Select value={period} onChange={(event) => setPeriod(event.target.value)} label={t('period')}>
            <MenuItem value="daily">{t('period_daily')}</MenuItem>
            <MenuItem value="weekly">{t('period_weekly')}</MenuItem>
            <MenuItem value="monthly">{t('period_monthly')}</MenuItem>
            <MenuItem value="yearly">{t('period_yearly')}</MenuItem>
            <MenuItem value="overall">{t('period_overall')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(1, minmax(0, 1fr))', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
        <Box sx={{ gridColumn: { md: 'span 2', lg: 'span 2' } }}>
          <ChartCard title={t('monthly_analysis')} icon={<ShowChartIcon color="primary" />}>
            <ReactApexChart
              key={`monthly-${locale}-${displayCurrency}`}
              type="area"
              height={300}
              options={monthlyChartOptions}
              series={monthlySeries}
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary', fontSize: '0.75rem' }}>
              {t('monthly_sales_trend')}
            </Typography>
          </ChartCard>
        </Box>

        <Box>
          <ChartCard title={`${t('most_sold')} (${t(`period_${period}`) || period})`} icon={<BarChartIcon color="secondary" />}>
            <ReactApexChart
              key={`most-sold-${locale}-${period}`}
              type="bar"
              height={300}
              options={topSoldOptions}
              series={topSoldSeries}
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('top_products_description') || `Top 5 products by quantity sold in the selected ${period} period.`}
            </Typography>
          </ChartCard>
        </Box>

        <Box sx={{ gridColumn: { md: 'span 2', lg: 'span 2' } }}>
          <ChartCard title={`${t('daily_sales_by_account')} (${selectedDate})`} icon={<BarChartIcon color="primary" />}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold', fontSize: { xs: '0.9rem', md: '1rem' } }}>
                {displayCurrency === 'USD'
                  ? `${t('total_label')}: $${formatMoney(dailySalesByAccount.displayTotal)}`
                  : `${t('total_label')}: ${formatMoney(dailySalesByAccount.displayTotal)} UZS`}
              </Typography>
              {displayCurrency === 'UZS' && dailySalesByAccount.totalUsd > 0 && (
                <Typography variant="caption" color="textSecondary">
                  (≈ ${formatMoney(dailySalesByAccount.totalUsd)} USD)
                </Typography>
              )}
              {displayCurrency === 'USD' && dailySalesByAccount.totalUzs > 0 && (
                <Typography variant="caption" color="textSecondary">
                  (≈ {formatMoney(dailySalesByAccount.totalUzs)} UZS)
                </Typography>
              )}
            </Box>
            <ReactApexChart
              type="bar"
              height={300}
              options={dailyAccountOptions}
              series={dailyAccountSeries}
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary', fontSize: '0.75rem' }}>
              {t('sales_percentage_description')}
            </Typography>
          </ChartCard>
        </Box>

        <Box>
          <ChartCard title={t('credits_summary')} icon={<CalendarTodayIcon color="info" />}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{t('given')}</Typography>
                <Typography sx={{ fontWeight: 'bold', color: 'error.main', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                  {formatMoney(creditsSummary.given)} {displayCurrency === 'USD' ? '$' : 'UZS'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{t('received')}</Typography>
                <Typography sx={{ fontWeight: 'bold', color: 'success.main', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                  {formatMoney(creditsSummary.received)} {displayCurrency === 'USD' ? '$' : 'UZS'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{t('completed')}</Typography>
                <Typography sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                  {formatMoney(creditsSummary.completed)} {displayCurrency === 'USD' ? '$' : 'UZS'}
                </Typography>
              </Box>
            </Box>
            <Typography
              variant="caption"
              sx={{
                mt: 1,
                color: 'text.secondary',
                fontSize: '0.75rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {t('credits_summary_description') || t('credits_summary')}
            </Typography>
          </ChartCard>
        </Box>

        <Box sx={{ gridColumn: '1 / -1' }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
            <DailySalesByDate selectedDate={selectedDate} onDateChange={setSelectedDate} />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

export default Dashboard;
