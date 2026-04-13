import React from 'react';
import { IconButton, Popover, Box, TextField, Typography, Tooltip, Button, Divider } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import useManualRate from '../hooks/useManualRate';
import { useLocale } from '../context/LocaleContext';
import useExchangeRate from '../hooks/useExchangeRate';
import NumberField from './NumberField';

export default function CurrencyConverter() {
  const { rate: manualRate, save: saveManualRate } = useManualRate();
  const { rate: liveRate, loading, error, refresh } = useExchangeRate();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [usdAmount, setUsdAmount] = React.useState('');
  const [uzsAmount, setUzsAmount] = React.useState('');
  const { t } = useLocale();

  const open = Boolean(anchorEl);
  const id = open ? 'currency-popover' : undefined;
  const toCurrency = 'UZS';

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const rate = manualRate || liveRate || null;

  const cleanNumber = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const normalized = val.toString().replace(/,/g, '').trim();
    const num = Number(normalized);
    return Number.isFinite(num) ? num : '';
  };

  const handleUsdChange = (val) => {
    const numUsd = cleanNumber(val);
    setUsdAmount(val ?? '');
    if (!rate || numUsd === '') {
      setUzsAmount('');
      return;
    }
    const uzs = Math.round(numUsd * Number(rate));
    setUzsAmount(uzs.toLocaleString('uz-UZ'));
  };

  const handleUzsChange = (val) => {
    const numUzs = cleanNumber(val);
    setUzsAmount(val ?? '');
    if (!rate || numUzs === '') {
      setUsdAmount('');
      return;
    }
    const usd = numUzs / Number(rate);
    const usdRounded = Math.round((usd + Number.EPSILON) * 100) / 100;
    setUsdAmount(usdRounded.toLocaleString('en-US'));
  };

  return (
    <>
      <Tooltip title={t('currencyConverter') || 'Currency'}>
        <IconButton color="inherit" onClick={handleOpen} size="small">
          <AttachMoneyIcon />
        </IconButton>
      </Tooltip>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, width: 320, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="subtitle1">{t('exchangeRate') || 'Rate'}</Typography>
            <Button size="small" variant="outlined" onClick={refresh} disabled={loading}>
              {loading ? (t('loading') || 'Loading') : (t('refresh') || 'Refresh')}
            </Button>
          </Box>
          <NumberField
            size="small"
            value={manualRate ?? ''}
            onChange={(val) => {
              if (val != null) saveManualRate(val);
            }}
            InputProps={{ endAdornment: <Typography variant="caption" sx={{ ml: 1 }}>{toCurrency}</Typography> }}
            sx={{ width: '100%' }}
          />
          {error && <Typography variant="caption" color="error">{error}</Typography>}

          <Divider />

          <Typography variant="subtitle2">{t('currencyConvert') || 'Valyuta konvertori'}</Typography>
          <NumberField
            size="small"
            value={usdAmount}
            onChange={handleUsdChange}
            placeholder="USD"
            InputProps={{ endAdornment: <Typography variant="caption" sx={{ ml: 1 }}>USD</Typography> }}
          />
          <TextField
            size="small"
            value={uzsAmount}
            onChange={(e) => handleUzsChange(e.target.value)}
            placeholder={rate ? 'UZS' : (t('exchangeRate') || 'Rate required')}
            InputProps={{ endAdornment: <Typography variant="caption" sx={{ ml: 1 }}>UZS</Typography> }}
          />
          <Typography variant="body2">
            {rate
              ? `1 USD = ${Number(rate).toLocaleString('uz-UZ')} UZS`
              : (t('exchangeRate') || 'Enter manual exchange rate to convert elsewhere in the app.')}
          </Typography>
        </Box>
      </Popover>
    </>
  );
}
