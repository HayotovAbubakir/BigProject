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

  const parseDetailPairs = (detail) => {
    if (!detail) return [];
    const parts = detail.split(',').map(p => p.trim()).filter(Boolean);
    const pairs = [];
    parts.forEach(part => {
      const idx = part.indexOf(':');
      if (idx > -1) {
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (key && value) pairs.push({ key, value });
      }
    });
    return pairs;
  };

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
  const detailPairs = parseDetailPairs(log.detail);

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
      <CardContent sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ color: meta.color }}>
            {meta.icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', wordBreak: 'break-word' }}>
              {t(log.action) || log.action}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
              <Chip label={t(log.action) || log.kind || log.action || 'LOG'} size="small" sx={{ backgroundColor: meta.color, color: 'white' }} />
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {log.date} {log.time} • {log.user_name}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Divider sx={{ my: 1.5 }} />
        {isCreditLog ? (
          <Box>
            <Grid container spacing={1}>
              {creditDetail.Klient && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2"><strong>Klient:</strong> {creditDetail.Klient}</Typography>
                </Grid>
              )}
              {creditDetail.Mahsulot && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2"><strong>Mahsulot:</strong> {creditDetail.Mahsulot}</Typography>
                </Grid>
              )}
              {creditDetail.Soni && (
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2"><strong>Soni:</strong> {creditDetail.Soni}</Typography>
                </Grid>
              )}
              {creditDetail.Narx && (
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2"><strong>Narx:</strong> {creditDetail.Narx}</Typography>
                </Grid>
              )}
              {creditDetail.Jami && (
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2"><strong>Jami:</strong> {creditDetail.Jami}</Typography>
                </Grid>
              )}
              {creditDetail['Bosh to\'lov'] && (
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2"><strong>Bosh to'lov:</strong> {creditDetail['Bosh to\'lov']}</Typography>
                </Grid>
              )}
              {creditDetail.Qolgan && (
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2"><strong>Qolgan:</strong> {creditDetail.Qolgan}</Typography>
                </Grid>
              )}
            </Grid>
            {detailPairs.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={1}>
                  {detailPairs.map((pair, idx) => (
                    <Grid item xs={12} sm={6} key={`${pair.key}-${idx}`}>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        <strong>{pair.key}:</strong> {pair.value}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              {log.product_name && <Typography variant="body2" sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}><strong>Mahsulot:</strong> {log.product_name}</Typography>}
            </Grid>
            <Grid item xs={12} md={6}>
              <Grid container spacing={1}>
                {log.qty && (
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Soni:</strong> {log.qty}</Typography>
                  </Grid>
                )}
                {log.unit_price != null && (
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Narx:</strong> {formatMoney(log.unit_price)} {log.currency}</Typography>
                  </Grid>
                )}
                {log.amount != null && (
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Jami:</strong> {formatMoney(log.amount)} {log.currency}</Typography>
                  </Grid>
                )}
              </Grid>
            </Grid>
            {detailPairs.length > 0 && (
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={1}>
                  {detailPairs.map((pair, idx) => (
                    <Grid item xs={12} sm={6} key={`${pair.key}-${idx}`}>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        <strong>{pair.key}:</strong> {pair.value}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            )}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}


export default function Logs() {
  const { state, dispatch } = useApp();
  const { user, confirmPassword, isDeveloper } = useAuth();
  const { t } = useLocale();
  const theme = useTheme();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const handleDeleteLogs = async () => {
    const pwd = prompt(t('enterAdminPassword'));
    if (pwd === null) return;
    if (!isDeveloper) {
      const verify = await confirmPassword(pwd);
      if (!verify || !verify.ok) return alert(t('incorrectPassword'));
    }
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
