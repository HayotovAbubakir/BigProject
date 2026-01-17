import React from 'react';
import { IconButton, Popover, Box, TextField, Typography, Tooltip } from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import useManualRate from '../hooks/useManualRate';
import { useLocale } from '../context/LocaleContext';
import { useApp } from '../context/useApp';

export default function CurrencyConverter() {
  const { rate: manualRate, save: saveManualRate } = useManualRate();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const { dispatch } = useApp();
  const { t } = useLocale();

  const open = Boolean(anchorEl);
  const id = open ? 'currency-popover' : undefined;
  const toCurrency = 'UZS';

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  React.useEffect(() => {
    setResult(null);
  }, [manualRate]);

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

          <Typography variant="body2">{t('exchangeRate') || 'Enter manual exchange rate to convert elsewhere in the app.'}</Typography>
        </Box>
      </Popover>
    </>
  );
}
