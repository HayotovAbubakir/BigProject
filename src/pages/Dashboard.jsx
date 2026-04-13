import React, { useState, useMemo } from 'react';
import { Grid, Card, CardContent, Typography, useTheme, Box, TextField, Paper, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import {
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
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

const ChartCard = ({ title, icon, children }) => (
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

      const monthlyAnalysisData = useMemo(() => {
        const monthlyMap = {};
        logs.forEach(log => {
          if (!log || log.kind !== 'SELL') return;
          
          // Normalize to base currency (UZS) for consistent calculation
          const amountInUzs = normalizeToBaseUzs(
            log.amount,
            log.currency,
            usdToUzs
          );
          
          const month = monthShortFromISO(log.date);
          if (!monthlyMap[month]) monthlyMap[month] = { month, sold: 0 };
          monthlyMap[month].sold += amountInUzs;
        });
        
        const sortedMonths = Object.values(monthlyMap).sort((a, b) => 
          new Date(a.month + '-01-2000') - new Date(b.month + '-01-2000')
        );
        
        // Convert to display currency for chart display
        return sortedMonths.map(m => ({
          month: m.month,
          sold: convertFromBaseUzs(m.sold, displayCurrency, usdToUzs)
        }));
      }, [logs, displayCurrency, usdToUzs]);
    
      const topSoldProducts = useMemo(() => {
        let filteredLogs = logs.filter(l => l && l.kind === 'SELL');
        if (period === 'daily') {
          filteredLogs = filteredLogs.filter(l => l.date === selectedDate);
        } else if (period === 'weekly') {
          const startOfWeek = new Date(selectedDate);
          startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          filteredLogs = filteredLogs.filter(l => {
            const d = new Date(l.date);
            return d >= startOfWeek && d <= endOfWeek;
          });
        } else if (period === 'monthly') {
          const month = selectedDate.slice(0, 7);
          filteredLogs = filteredLogs.filter(l => l.date.startsWith(month));
        } else if (period === 'yearly') {
          const year = selectedDate.slice(0, 4);
          filteredLogs = filteredLogs.filter(l => l.date.startsWith(year));
        }
        const productQty = {};
        const allProducts = [...(state.warehouse || []), ...(state.store || [])];
        const productMap = new Map(allProducts.map(p => [p.id, p]));

        const addProductQty = (name, qty, meta = {}) => {
          const safeQty = Number(qty) || 0;
          if (!name || Number.isNaN(safeQty)) return;
          if (!productQty[name]) {
            productQty[name] = { qty: 0, meta };
          }
          productQty[name].qty += safeQty;
          // keep meta populated with any provided fields
          productQty[name].meta = { ...productQty[name].meta, ...meta };
        };

        const toPieces = (qty, unit, packQty, productId) => {
          const pq = Number(packQty || (productMap.get(productId)?.pack_qty ?? 0) || 0);
          const unitLower = (unit || '').toString().toLowerCase();
          if (unitLower === 'metr' && pq > 0) {
            return Math.ceil(Number(qty || 0) / pq);
          }
          return Number(qty || 0);
        };

        filteredLogs.forEach(l => {
          const action = (l.action || '').toLowerCase();
          // Skip counting the aggregated wholesale bundle itself; instead expand items
          if (action === 'wholesale_sale') {
            try {
              const detailStr = l.detail || '';
              const parsed = detailStr.startsWith('WHOLESALE_JSON:') ? JSON.parse(detailStr.replace('WHOLESALE_JSON:', '')) : null;
              const items = parsed?.items || [];
              items.forEach((item) => {
                const name = item.name || item.id || 'Unknown';
                const qtyPieces = toPieces(
                  item.unit === 'metr' ? (item.meter_sold ?? item.qty) : item.qty,
                  item.unit,
                  item.pack_qty,
                  item.id
                );
                addProductQty(name, qtyPieces, {
                  category: item.category,
                  size: item.electrode_size || item.stone_size || '',
                  thickness: item.stone_thickness || '',
                  packQty: item.pack_qty,
                  isMeter: item.unit === 'metr' || item.isMeter
                });
              });
            } catch (e) {
              console.warn('Failed to parse wholesale detail for top products', e);
            }
            return;
          }

          let name = l.productName || l.product_name;
          if (!name && l.productId) {
            const product = allProducts.find(p => p.id === l.productId);
            if (product) {
              name = product.name;
            }
          }
          if (!name) {
            name = 'Unknown';
          }
          const qtyPieces = toPieces(l.qty, l.unit, l.pack_qty, l.productId || l.product_id);
          const p = productMap.get(l.productId || l.product_id);
          addProductQty(name, qtyPieces, {
            category: p?.category,
            size: p?.electrode_size || p?.stone_size || '',
            thickness: p?.stone_thickness || '',
            packQty: p?.pack_qty,
            isMeter: p ? !!p.meter_qty || (p.pack_qty > 0) : false
          });
        });
        // Ensure we always consider all products (even with 0 sales) to have at least 5 rows
        allProducts.forEach(p => {
          const name = p.name || p.title || p.id || 'Unknown';
          if (!(name in productQty)) productQty[name] = { qty: 0, meta: { category: p.category, size: p.electrode_size || p.stone_size || '', thickness: p.stone_thickness || '', packQty: p.pack_qty, isMeter: !!p.meter_qty || !!p.pack_qty } };
        });
        const sorted = Object.entries(productQty)
          .sort(([, a], [, b]) => b.qty - a.qty);
        // If fewer than 5, pad with placeholders so chart always shows 5 bars
        while (sorted.length < 5) {
          sorted.push([`— ${sorted.length + 1}`, { qty: 0, meta: {} }]);
        }
        return sorted.slice(0, 5);
      }, [logs, period, selectedDate, state.warehouse, state.store]);

      const dailySalesByAccount = useMemo(() => {
        const accountSales = {}; // { user: { usd: 0, uzs: 0, totalUzs: 0, displayValue: 0 } }
        let grandTotalUzs = 0;
        let grandTotalUsd = 0;
        
        logs.filter(l => l && l.kind === 'SELL' && l.date === selectedDate).forEach(l => {
          const username = l.user || l.user_name || 'Unknown';
          const unameLower = (username || '').toString().toLowerCase();
          const account = state.accounts.find(a => (a.username || '').toString().toLowerCase() === unameLower);
          const user = account ? (account.label || account.username || username) : username;
          
          // Initialize if needed
          if (!accountSales[user]) {
            accountSales[user] = { usd: 0, uzs: 0, totalUzs: 0, displayValue: 0 };
          }
          
          const currency = (l.currency || 'UZS').toUpperCase();
          const amount = Number(l.amount) || 0;
          
          // Track original currency amounts ALWAYS
          if (currency === 'USD') {
            accountSales[user].usd += amount;
            grandTotalUsd += amount;
            // Only add to totalUzs if we have an exchange rate to convert properly
            if (usdToUzs && usdToUzs > 0) {
              const amountInUzs = Math.round(amount * usdToUzs);
              accountSales[user].totalUzs += amountInUzs;
              grandTotalUzs += amountInUzs;
            }
          } else {
            accountSales[user].uzs += amount;
            grandTotalUzs += amount;
            accountSales[user].totalUzs += amount;
          }
        });
        
        // For display: convert grand total based on displayCurrency
        let displayTotal = 0;
        if (displayCurrency === 'USD') {
          // If displaying in USD: show grandTotalUsd directly + converted UZS
          displayTotal = grandTotalUsd;
          if (grandTotalUzs > 0 && usdToUzs && usdToUzs > 0) {
            displayTotal += convertFromBaseUzs(grandTotalUzs, 'USD', usdToUzs);
          }
        } else {
          // If displaying in UZS: show grandTotalUzs directly + converted USD
          displayTotal = grandTotalUzs;
          if (grandTotalUsd > 0 && usdToUzs && usdToUzs > 0) {
            displayTotal += Math.round(grandTotalUsd * usdToUzs);
          }
        }
        
        const withPercent = Object.entries(accountSales).map(([user, amounts]) => {
          // Calculate display value for this account based on displayCurrency
          let accountDisplayValue = 0;
          if (displayCurrency === 'USD') {
            accountDisplayValue = amounts.usd;
            if (amounts.uzs > 0 && usdToUzs && usdToUzs > 0) {
              accountDisplayValue += convertFromBaseUzs(amounts.uzs, 'USD', usdToUzs);
            }
          } else {
            // UZS display
            accountDisplayValue = amounts.uzs;
            if (amounts.usd > 0 && usdToUzs && usdToUzs > 0) {
              accountDisplayValue += Math.round(amounts.usd * usdToUzs);
            }
          }
          
          // Percentage based only on converted totals (can properly compare)
          let percentBase = 0;
          if (displayCurrency === 'USD') {
            percentBase = grandTotalUsd + (grandTotalUzs > 0 && usdToUzs && usdToUzs > 0 ? convertFromBaseUzs(grandTotalUzs, 'USD', usdToUzs) : 0);
          } else {
            percentBase = grandTotalUzs + (grandTotalUsd > 0 && usdToUzs && usdToUzs > 0 ? Math.round(grandTotalUsd * usdToUzs) : 0);
          }
          
          return {
            user,
            usd: amounts.usd,
            uzs: amounts.uzs,
            totalUzs: amounts.totalUzs,
            displayValue: accountDisplayValue,
            percent: percentBase > 0 ? ((accountDisplayValue / percentBase) * 100).toFixed(1) : 0
          };
        });
        
        return { 
          accounts: withPercent, 
          totalUsd: grandTotalUsd, 
          totalUzs: grandTotalUzs,
          displayTotal,
          displayCurrency 
        };
      }, [logs, selectedDate, state.accounts, usdToUzs, displayCurrency]);

      const creditsSummary = useMemo(() => {
        // Separate credits by type
        const direction = (c) => (c?.credit_direction || c?.type || '').toString().toLowerCase();
        const givenCredits = (state.credits || []).filter(c => direction(c) === 'berilgan');
        const receivedCredits = (state.credits || []).filter(c => direction(c) === 'olingan');
        const completedCredits = (state.credits || []).filter(c => c.completed);
        
        // Calculate totals in display currency
        const givenTotal = calculateCreditTotals(givenCredits, displayCurrency, usdToUzs, 'all');
        const receivedTotal = calculateCreditTotals(receivedCredits, displayCurrency, usdToUzs, 'all');
        const completedTotal = calculateCreditTotals(completedCredits, displayCurrency, usdToUzs, 'all');
        
        return {
          given: givenTotal.total,
          received: receivedTotal.total,
          completed: completedTotal.total,
          givenUzs: givenTotal.totalUzs,
          receivedUzs: receivedTotal.totalUzs,
          completedUzs: completedTotal.totalUzs
        };
      }, [state.credits, displayCurrency, usdToUzs]);
  const chartOptions = {
    chart: {
      animations: {
        speed: 400,
        animateGradually: { enabled: true, delay: 150 },
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
        formatter: (v) => formatMoney(v),
      },
    },
    tooltip: {
      theme: theme.palette.mode,
      y: { formatter: (v) => `${formatMoney(v)} UZS` },
    },
    legend: { labels: { colors: theme.palette.text.primary } },
    grid: { borderColor: theme.palette.divider },
  };

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
          onChange={(e) => setSelectedDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>{t('period')}</InputLabel>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} label={t('period')}>
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
              key={`monthly-${locale}`}
              type="area"
              height={300}
              options={{
                ...chartOptions,
                colors: [theme.palette.primary.main, theme.palette.secondary.main],
                xaxis: { ...chartOptions.xaxis, categories: monthlyAnalysisData.map(m => m.month) },
                tooltip: {
                  ...chartOptions.tooltip,
                  y: {
                    formatter: (v) => `${formatMoney(v)} ${displayCurrency === 'USD' ? '$' : 'UZS'}`
                  }
                }
              }}
              series={[
                { name: t('sold'), data: monthlyAnalysisData.map(m => m.sold) },
              ]}
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
              options={{
                ...chartOptions,
                plotOptions: {
                  bar: {
                    horizontal: true,
                    barHeight: '50%',
                    borderRadius: 4,
                    distributed: true,
                    dataLabels: {
                      position: 'bottom'
                    }
                  }
                },
                colors: [
                  theme.palette.primary.light,
                  theme.palette.secondary.light,
                  theme.palette.error.light,
                  theme.palette.warning.light,
                  theme.palette.success.light
                ],
                dataLabels: {
                  enabled: true,
                  textAnchor: 'start',
                  style: {
                    colors: [theme.palette.text.primary]
                  },
                  formatter: (val, opt) => (`${opt.w.globals.labels[opt.dataPointIndex]}: ${val}`),
                  offsetX: 0,
                  dropShadow: {
                    enabled: true
                  }
                },
                xaxis: {
                  ...chartOptions.xaxis,
                  categories: topSoldProducts.map(([name, data]) => {
                    const { category, size, thickness, packQty, isMeter } = data.meta || {};
                    const parts = [];
                    if (category) parts.push(category);
                    if (size) parts.push(size);
                    if (thickness) parts.push(thickness);
                    if (isMeter && packQty) parts.push(`${packQty}m/dona`);
                    const meta = parts.length ? ` (${parts.join(' • ')})` : '';
                    return `${name}${meta}`;
                  }),
                },
                yaxis: {
                  labels: {
                    show: false
                  }
                },
                grid: {
                  ...chartOptions.grid,
                  show: false
                },
                legend: { show: false },
                tooltip: {
                  theme: theme.palette.mode,
                  y: {
                    title: {
                      formatter: (seriesName, opt) => (
                        opt.w.globals.labels[opt.dataPointIndex]
                      )
                    }
                  }
                }
              }}
              series={[{ name: t('quantity_sold'), data: topSoldProducts.map(([, data]) => data.qty) }]}
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
                  : `${t('total_label')}: ${formatMoney(dailySalesByAccount.displayTotal)} UZS`
                }
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
              options={{
                ...chartOptions,
                xaxis: { categories: dailySalesByAccount.accounts.map(a => a.user) },
                plotOptions: {
                  bar: { horizontal: false, dataLabels: { position: 'top' } }
                },
                dataLabels: {
                  enabled: true,
                  formatter: (val, opts) => {
                    const acc = dailySalesByAccount.accounts[opts.dataPointIndex];
                    return `${acc.displayValue > 0 ? (displayCurrency === 'USD' ? `$${formatMoney(acc.displayValue)}` : `${formatMoney(acc.displayValue)}`) : '0'} (${val}%)`;
                  },
                  style: { colors: [theme.palette.text.primary], fontSize: '11px' }
                },
                tooltip: {
                  ...chartOptions.tooltip,
                  y: {
                    formatter: (val, opts) => {
                      const acc = dailySalesByAccount.accounts[opts.dataPointIndex];
                      return `${displayCurrency === 'USD' ? `$${formatMoney(acc.displayValue)}` : `${formatMoney(acc.displayValue)} UZS`} (${val}%)`;
                    }
                  }
                }
              }}
              series={[
                { name: t('percentage'), data: dailySalesByAccount.accounts.map(a => Number(a.percent)) }
              ]}
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
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary', fontSize: '0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
