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
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {icon}
        <Typography variant="h6" component="div" sx={{ ml: 1 }}>
          {title}
        </Typography>
      </Box>
      {children}
    </CardContent>
  </Card>
);

function Dashboard() {
  const { state } = useApp();
  const { t } = useLocale();
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
        filteredLogs.forEach(l => {
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
          productQty[name] = (productQty[name] || 0) + (Number(l.qty) || 0);
        });
        return Object.entries(productQty)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);
      }, [logs, period, selectedDate, state.warehouse, state.store]);

      const dailySalesByAccount = useMemo(() => {
        const accountSales = {}; // { user: { usd: 0, uzs: 0, totalUzs: 0, displayValue: 0 } }
        let grandTotalUzs = 0;
        let grandTotalUsd = 0;
        
        logs.filter(l => l && l.kind === 'SELL' && l.date === selectedDate).forEach(l => {
          const username = l.user || l.user_name || 'Unknown';
          const account = state.accounts.find(a => a.username === username);
          const user = account ? account.label : username;
          
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

      const topExpensiveProducts = useMemo(() => {
        const month = selectedDate.slice(0, 7);
        const filteredLogs = logs.filter(l => l && l.kind === 'SELL' && String(l.date || '').startsWith(month));
        const products = {};
        
        filteredLogs.forEach(l => {
          const name = l.productName || l.product_name || 'Unknown';
          const unitPrice = Number(l.unitPrice ?? l.unit_price ?? l.price ?? 0) || 0;
          const currency = l.currency || l.curr || 'UZS';
          
          // Normalize to base currency for comparison
          const priceInUzs = normalizeToBaseUzs(unitPrice, currency, usdToUzs);
          
          if (!products[name]) {
            products[name] = { name, priceInUzs, originalPrice: unitPrice, originalCurrency: currency };
          } else if (products[name].priceInUzs < priceInUzs) {
            products[name] = { name, priceInUzs, originalPrice: unitPrice, originalCurrency: currency };
          }
        });
        
        return Object.values(products)
          .sort((a, b) => b.priceInUzs - a.priceInUzs)
          .slice(0, 5)
          .map(p => ({
            name: p.name,
            price: convertFromBaseUzs(p.priceInUzs, displayCurrency, usdToUzs),
            currency: displayCurrency,
            originalPrice: p.originalPrice,
            originalCurrency: p.originalCurrency
          }));
      }, [logs, selectedDate, displayCurrency, usdToUzs]);

      const creditsSummary = useMemo(() => {
        // Separate credits by type
        const givenCredits = (state.credits || []).filter(c => c.type === 'berilgan');
        const receivedCredits = (state.credits || []).filter(c => c.type === 'olingan');
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
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          label={t('select_date') || 'Select Date'}
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          size="small"
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{t('period') || 'Period'}</InputLabel>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} label={t('period') || 'Period'}>
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="yearly">Yearly</MenuItem>
            <MenuItem value="overall">Overall</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <ChartCard title={t('monthly_analysis')} icon={<ShowChartIcon color="primary" />}>
            <ReactApexChart
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
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('monthly_sales_trend') || 'Tracks monthly sales trends over time. Only outgoing sales are included. Values shown in selected currency.'}
            </Typography>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={4}>
          <ChartCard title={`${t('most_sold')} (${period})`} icon={<BarChartIcon color="secondary" />}>
            <ReactApexChart
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
                  categories: topSoldProducts.map(([name]) => name),
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
              series={[{ name: t('quantity_sold'), data: topSoldProducts.map(([, qty]) => qty) }]}
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('top_products_description') || `Top 5 products by quantity sold in the selected ${period} period.`}
            </Typography>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title={`${t('daily_sales_by_account')} (${selectedDate})`} icon={<BarChartIcon color="primary" />}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                {displayCurrency === 'USD' 
                  ? `Total: $${formatMoney(dailySalesByAccount.displayTotal)}`
                  : `Total: ${formatMoney(dailySalesByAccount.displayTotal)} UZS`
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
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('sales_percentage_description') || 'Shows sales by account. Values displayed in selected currency.'}
            </Typography>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title={`${t('top_expensive_products')} (${selectedDate.slice(0, 7)})`} icon={<ShowChartIcon color="error" />}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {topExpensiveProducts.map((p, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography>{p.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 'bold' }}>
                      {displayCurrency === 'USD' 
                        ? `$${formatMoney(p.price)}`
                        : `${formatMoney(p.price)} UZS`
                      }
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      ({p.originalCurrency})
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('top_expensive_description') || 'Highest unit price products sold in the selected month. Prices shown in selected currency.'}
            </Typography>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={4}>
          <ChartCard title={t('credits_summary')} icon={<CalendarTodayIcon color="info" />}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>{t('given')}</Typography>
                <Typography sx={{ fontWeight: 'bold', color: 'error.main' }}>
                  {formatMoney(creditsSummary.given)} {displayCurrency === 'USD' ? '$' : 'UZS'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>{t('received')}</Typography>
                <Typography sx={{ fontWeight: 'bold', color: 'success.main' }}>
                  {formatMoney(creditsSummary.received)} {displayCurrency === 'USD' ? '$' : 'UZS'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>{t('completed')}</Typography>
                <Typography sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  {formatMoney(creditsSummary.completed)} {displayCurrency === 'USD' ? '$' : 'UZS'}
                </Typography>
              </Box>
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('credits_summary_description') || 'Total credits given to clients, received from suppliers, and completed payments.'}
            </Typography>
          </ChartCard>
        </Grid>
        
        <Grid item xs={12}>
          <Paper elevation={0} variant="outlined" sx={{p: 2}}>
             <DailySalesByDate selectedDate={selectedDate} onDateChange={setSelectedDate} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;