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
import { formatMoney } from '../utils/format';
import { monthShortFromISO } from '../utils/date';
import { useLocale } from '../context/LocaleContext';
import DailySalesByDate from '../components/DailySalesByDate';

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
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [period, setPeriod] = useState('overall');

  const logs = useMemo(() => state.logs || [], [state.logs]);

      const monthlyAnalysisData = useMemo(() => {
        const monthlyMap = {};
        logs.forEach(log => {
          if (!log) return; // Add null check for log
          const amount = log.total_uzs || 0;
          if (!amount) return;
          const month = monthShortFromISO(log.date);
          if (!monthlyMap[month]) monthlyMap[month] = { month, sold: 0 };
          if (log.kind === 'SELL') monthlyMap[month].sold += amount;
        });
        const sortedMonths = Object.values(monthlyMap).sort((a, b) => new Date(a.month + '-01-2000') - new Date(b.month + '-01-2000'));
        return sortedMonths;
      }, [logs]);
    
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
        const accountSales = {};
        const total = { amount: 0 };
        logs.filter(l => l && l.kind === 'SELL' && l.date === selectedDate).forEach(l => {
          const username = l.user || l.user_name || 'Unknown';
          const account = state.accounts.find(a => a.username === username);
          const user = account ? account.label : username;
          const amount = l.total_uzs || 0;
          accountSales[user] = (accountSales[user] || 0) + amount;
          total.amount += amount;
        });
        const withPercent = Object.entries(accountSales).map(([user, amount]) => ({
          user,
          amount,
          percent: total.amount > 0 ? ((amount / total.amount) * 100).toFixed(1) : 0
        }));
        return { accounts: withPercent, total: total.amount };
      }, [logs, selectedDate, state.accounts]);

      const topExpensiveProducts = useMemo(() => {
        const month = selectedDate.slice(0, 7);
        const filteredLogs = logs.filter(l => l && l.kind === 'SELL' && l.date.startsWith(month));
        const products = {};
        filteredLogs.forEach(l => {
          const name = l.productName || 'Unknown';
          const unitPrice = l.unitPrice || 0;
          if (!products[name] || products[name].price < unitPrice) {
            products[name] = { name, price: unitPrice };
          }
        });
        return Object.values(products).sort((a, b) => b.price - a.price).slice(0, 5);
      }, [logs, selectedDate]);

      const creditsSummary = useMemo(() => {
        const summary = { given: 0, received: 0, completed: 0 };
        (state.credits || []).forEach(c => {
          if (c.type === 'berilgan') summary.given += c.amount_uzs || c.amount || 0;
          else if (c.type === 'olingan') summary.received += c.amount_uzs || c.amount || 0;
          if (c.completed) summary.completed += c.amount_uzs || c.amount || 0;
        });
        return summary;
      }, [state.credits]);
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
              }}
              series={[
                { name: t('sold'), data: monthlyAnalysisData.map(m => m.sold) },
              ]}
            />            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('monthly_sales_trend') || 'Tracks monthly sales trends over time. Only outgoing sales are included.'}
            </Typography>          </ChartCard>
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
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t('total_sales')}: {formatMoney(dailySalesByAccount.total)} UZS
            </Typography>
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
                    const amount = dailySalesByAccount.accounts[opts.dataPointIndex].amount;
                    return `${formatMoney(amount)} (${val}%)`;
                  },
                  style: { colors: [theme.palette.text.primary], fontSize: '12px' }
                },
                tooltip: {
                  ...chartOptions.tooltip,
                  y: {
                    formatter: (val, opts) => {
                      const amount = dailySalesByAccount.accounts[opts.dataPointIndex].amount;
                      return `${formatMoney(amount)} UZS (${val}%)`;
                    }
                  }
                }
              }}
              series={[
                { name: t('percentage'), data: dailySalesByAccount.accounts.map(a => Number(a.percent)) }
              ]}
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('sales_percentage_description') || 'Shows the percentage contribution of each account to total daily sales. Hover for amounts.'}
            </Typography>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <ChartCard title={`${t('top_expensive_products')} (${selectedDate.slice(0, 7)})`} icon={<ShowChartIcon color="error" />}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {topExpensiveProducts.map((p, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography>{p.name}</Typography>
                  <Typography sx={{ fontWeight: 'bold' }}>{formatMoney(p.price)} UZS</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              {t('top_expensive_description') || 'Highest unit price products sold in the selected month.'}
            </Typography>
          </ChartCard>
        </Grid>

        <Grid item xs={12} lg={4}>
          <ChartCard title={t('credits_summary')} icon={<CalendarTodayIcon color="info" />}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>{t('given')}</Typography>
                <Typography sx={{ fontWeight: 'bold', color: 'error.main' }}>{formatMoney(creditsSummary.given)} UZS</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>{t('received')}</Typography>
                <Typography sx={{ fontWeight: 'bold', color: 'success.main' }}>{formatMoney(creditsSummary.received)} UZS</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>{t('completed')}</Typography>
                <Typography sx={{ fontWeight: 'bold', color: 'primary.main' }}>{formatMoney(creditsSummary.completed)} UZS</Typography>
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