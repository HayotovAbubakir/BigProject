import React from 'react';
import { IconButton, Popover, Box, TextField, MenuItem, Typography, Tooltip } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import useManualRate from '../hooks/useManualRate';
import { useLocale } from '../context/LocaleContext';
import { useApp } from '../context/useApp';

export default function CurrencyConverter() {
  const { rate: manualRate, save: saveManualRate } = useManualRate();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [amount, setAmount] = React.useState('');
  const [fromCurrency, setFromCurrency] = React.useState('UZS');
  const [result, setResult] = React.useState(null);
  const { dispatch } = useApp();
  const { t } = useLocale();

  const open = Boolean(anchorEl);
  const id = open ? 'currency-popover' : undefined;
  const toCurrency = fromCurrency === 'USD' ? 'UZS' : 'USD';

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  React.useEffect(() => {
    if (amount && manualRate) {
      const val = parseFloat(String(amount).replace(/,/g, ''));
      if (!isNaN(val) && val > 0) {
        let out;
        if (fromCurrency === 'USD') {
          out = val * manualRate;
        } else {
          out = val / manualRate;
        }
        setResult(out);
        try {
          dispatch({ type: 'SET_UI', payload: { lastConversion: { amount: val, fromCurrency, toCurrency: fromCurrency === 'USD' ? 'UZS' : 'USD', result: out, ts: Date.now() } } });
        } catch (e) {
          void e;
        }
      } else {
        setResult(null);
      }
    } else {
      setResult(null);
    }
  }, [amount, fromCurrency, manualRate, dispatch]);

  return (
    <>
      <Tooltip title={t('currencyConverter') || 'Currency'}>
        <IconButton color="inherit" onClick={handleOpen} size="small">
          <AttachMoneyIcon />
        </IconButton>
      </Tooltip>
      <Popover id={id} open={open} anchorEl={anchorEl} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ p: 2, width: 300, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="subtitle1">{t('exchangeRate') || 'Rate'}</Typography>
            <TextField
                size="small"
                type="number"
                value={manualRate || ''}
                onChange={(e) => {
                    const val = e.target.value;
                    saveManualRate(val);
                }}
                sx={{ width: 120 }}
            />
          </Box>

          <TextField 
            size="small" 
            label={t('amount') || 'Amount'} 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            type="number" 
            />

          <TextField 
            size="small" 
            select 
            label={t('from') || 'From'} 
            value={fromCurrency} 
            onChange={(e) => setFromCurrency(e.target.value)}
            >
            <MenuItem value="USD">USD</MenuItem>
            <MenuItem value="UZS">UZS</MenuItem>
          </TextField>

          {result !== null && (
            <Box sx={{ p: 1.5, bgcolor: 'primary.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'white' }}>
                {amount} {fromCurrency} = <strong>{result.toFixed(2)} {toCurrency}</strong>
              </Typography>
            </Box>
          )}
        </Box>
      </Popover>
    </>
  );
}
