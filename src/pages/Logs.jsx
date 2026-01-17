import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, useMediaQuery, useTheme, Chip, Tooltip, IconButton, Card, CardContent, Divider
} from '@mui/material';
import {
  CalendarToday as CalendarTodayIcon,
  DeleteSweep as DeleteSweepIcon,
  Info as InfoIcon,
  ShoppingCart as ShoppingCartIcon,
  AddShoppingCart as AddShoppingCartIcon,
  Warning as WarningIcon,
  MoveDown as MoveDownIcon,
  CreditCard as CreditCardIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useApp } from '../context/useApp';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import { formatMoney } from '../utils/format';

const logIcons = {
  SELL: <ShoppingCartIcon />,
  ADD: <AddShoppingCartIcon />,
  MOVE: <MoveDownIcon />,
  DELETE: <DeleteSweepIcon />,
  CREDIT_ADD: <CreditCardIcon />,
  CREDIT_EDIT: <CreditCardIcon />,
  CREDIT_DELETE: <CreditCardIcon />,
  CLIENT_ADD: <PersonIcon />,
  CLIENT_EDIT: <PersonIcon />,
  CLIENT_DELETE: <PersonIcon />,
  DEFAULT: <InfoIcon />
};

const logColors = {
  SELL: 'primary.main',
  ADD: 'success.main',
  MOVE: 'info.main',
  DELETE: 'error.main',
  CREDIT_ADD: 'secondary.main',
  CREDIT_EDIT: 'secondary.main',
  CREDIT_DELETE: 'error.main',
  CLIENT_ADD: 'success.main',
  CLIENT_EDIT: 'info.main',
  CLIENT_DELETE: 'error.main',
  DEFAULT: 'text.secondary'
}

function getLogMeta(log) {
  // Prefer a specific mapping by kind (if provided), else fall back to action keywords
  const kind = (log.kind || '').toString().toUpperCase();
  const action = (log.action || '').toString().toUpperCase();

  // Determine icon by kind then action
  let icon = logIcons[kind] || null
  if (!icon) icon = logIcons[action] || null
  if (!icon) icon = logIcons.DEFAULT

  // Determine color: prefer kind mapping, then action keywords, then defaults
  let color = logColors[kind] || logColors.DEFAULT
  if (!color) color = logColors[action] || logColors.DEFAULT

  // If action contains delete, force error color
  if (action.includes('DELETE') || action.includes('DELETED') || (log.type && log.type.toString().toUpperCase().includes('DELETE'))) {
    color = logColors.DELETE || 'error.main'
    icon = logIcons.DELETE
  }
  // If action contains add/create, prefer success color
  if (action.includes('ADD') || action.includes('CREATE')) {
    color = logColors.ADD || 'success.main'
  }

  return { icon, color };
}

function LogItem({ log }) {
  const meta = getLogMeta(log);
  const theme = useTheme();
  const isCreditLog = (log.kind || '').toString().toUpperCase().includes('CREDIT') || (log.action || '').toString().toUpperCase().includes('CREDIT');
  const { t } = useLocale();

  // Parse detail for credit logs
  const parseCreditDetail = (detail) => {
    const parsed = {};
    if (!detail) return parsed;
    const parts = detail.split(', ');
    parts.forEach(part => {
      const [key, value] = part.split(': ');
      if (key && value) {
        parsed[key] = value;
      }
    });
    return parsed;
  };

  const creditDetail = isCreditLog ? parseCreditDetail(log.detail) : {};

  return (
    <Card sx={{ 
      mb: 2, 
      borderLeft: `5px solid ${theme.palette.primary.main}`,
      borderColor: meta.color,
      transition: 'box-shadow 0.3s',
      '&:hover': {
        boxShadow: theme.shadows[4]
      }
    }}>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={1}>
            <Box sx={{ color: meta.color }}>
              {meta.icon}
            </Box>
          </Grid>
          <Grid item xs={11}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{t(log.action) || log.action}</Typography>
            <Chip label={t(log.action) || log.kind || log.action || 'LOG'} size="small" sx={{ mr: 1, backgroundColor: meta.color, color: 'white' }} />
            <Typography variant="caption" color="text.secondary">
              {log.date} {log.time} &bull; {log.user_name}
            </Typography>
          </Grid>
        </Grid>
        <Divider sx={{ my: 1.5 }} />
        {isCreditLog ? (
          <Box>
            {creditDetail.Klient && <Typography variant="body2"><strong>Klient:</strong> {creditDetail.Klient}</Typography>}
            {creditDetail.Mahsulot && <Typography variant="body2"><strong>Mahsulot:</strong> {creditDetail.Mahsulot}</Typography>}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
              {creditDetail.Soni && <Typography variant="body2"><strong>Soni:</strong> {creditDetail.Soni}</Typography>}
              {creditDetail.Narx && <Typography variant="body2"><strong>Narx:</strong> {creditDetail.Narx}</Typography>}
              {creditDetail.Jami && <Typography variant="body2"><strong>Jami:</strong> {creditDetail.Jami}</Typography>}
              {creditDetail['Bosh to\'lov'] && <Typography variant="body2"><strong>Bosh to'lov:</strong> {creditDetail['Bosh to\'lov']}</Typography>}
              {creditDetail.Qolgan && <Typography variant="body2"><strong>Qolgan:</strong> {creditDetail.Qolgan}</Typography>}
            </Box>
            {log.detail && <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', fontSize: '0.8rem', color: 'text.secondary' }}>{log.detail}</Typography>}
          </Box>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              {log.product_name && <Typography variant="body2"><strong>Mahsulot:</strong> {log.product_name}</Typography>}
              {log.detail && <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>{log.detail}</Typography>}
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {log.qty && <Typography variant="body2"><strong>Soni:</strong> {log.qty}</Typography>}
                {log.unit_price != null && <Typography variant="body2"><strong>Narx:</strong> {formatMoney(log.unit_price)} {log.currency}</Typography>}
                {log.amount != null && <Typography variant="body2"><strong>Jami:</strong> {formatMoney(log.amount)} {log.currency}</Typography>}
              </Box>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}


export default function Logs() {
  const { state, dispatch } = useApp();
  const { user, hasPermission, verifyLocalPassword, isDeveloper } = useAuth();
  const { t } = useLocale();
  const theme = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const handleDeleteLogs = async () => {
    const pwd = prompt(t('enterAdminPassword'));
    if (pwd === null) return;
    if (!isDeveloper && !verifyLocalPassword(user?.username, pwd)) return alert(t('incorrectPassword'));
    if (!confirm(`${t('confirmDeleteLogs')} (${filteredLogs.length})`)) return;

    dispatch({ type: 'DELETE_LOGS_FOR_DATE', payload: { date: selectedDate, user: user?.username } });
  };

  const filteredLogs = state.logs.filter(l => l && l.date === selectedDate).sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">{t('logs')}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            InputProps={{
              startAdornment: (
                <IconButton size="small">
                  <CalendarTodayIcon />
                </IconButton>
              )
            }}
          />
           <Tooltip title={t('delete_logs_for_date')}>
             <IconButton onClick={handleDeleteLogs} color="error">
              <DeleteSweepIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
      
      {filteredLogs.length > 0 ? (
        filteredLogs.map((log, i) => <LogItem key={i} log={log} />)
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">{t('no_logs_for_date')}</Typography>
        </Paper>
      )}

    </Box>
  );
}
