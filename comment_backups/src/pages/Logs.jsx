import React from 'react'
import { Box, Typography, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Grid, TextField, Button, useMediaQuery, IconButton } from '@mui/material'
import { useApp } from '../context/AppContext'
import { useLocale } from '../context/LocaleContext'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'

export default function Logs() {
  const { state } = useApp()
  // Logs page shows the full log history (all actions). Add responsive date filter.
  const { t } = useLocale()
  const isNarrow = useMediaQuery('(max-width:500px)')
  const today = new Date().toISOString().slice(0,10)
  const [selectedDate, setSelectedDate] = React.useState(today)

  return (
    <Box sx={{ display: 'flex', justifyContent: 'start', alignItems:'center' }}>
  <Box sx={{ width: '100%', px: { xs: 2, sm: 2, md: 0 } }}>
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
    <Typography variant="h4" gutterBottom>{t('logs')}</Typography>
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        size="small"
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <Button size="small" variant="outlined" onClick={() => setSelectedDate(today)}>{t('today')}</Button>
    </Box>
  </Box>

        <Card>
          <CardContent>
            <TableContainer sx={{ overflowX: 'auto', display: { xs: 'none', md: 'block' } }}>
              <Table sx={{ tableLayout: 'fixed', minWidth: 700 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 160 }}>{t('date')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>{t('time')}</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>{t('user')}</TableCell>
                  <TableCell sx={{ minWidth: 200, textAlign: 'center' }}>{t('action')}</TableCell>
                  <TableCell sx={{ minWidth: 420, wordBreak: 'break-word', textAlign: 'center' }}>{t('detail')}</TableCell>
                </TableRow> 
              </TableHead>
              <TableBody>
                {state.logs.filter(l => (l.date || '').toString().slice(0,10) === selectedDate).map((l, i) => (
                  <TableRow key={i}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.date}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.time}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>{l.user}</TableCell>
                      <TableCell sx={{ minWidth: 200, textAlign: 'center' }}>{l.action}</TableCell>
                      <TableCell sx={{ minWidth: 420, wordBreak: 'break-word', textAlign: 'left' }}>
                        <Typography sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.detail}</Typography>
                      </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </TableContainer>

            {/* Mobile cards */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <Grid container spacing={2}>
                  {state.logs.filter(l => (l.date || '').toString().slice(0,10) === selectedDate).map((l, i) => (
                    <Grid item xs={12} key={i}>
                      <Card>
                        <CardContent sx={{ py: 1, px: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 700, fontSize: isNarrow ? 14 : 16, mb: 0.25 }}>{l.action}</Typography>
                              <Typography variant="caption" color="text.secondary">{l.date} {l.time} • {l.user}</Typography>
                              <Typography variant="body2" sx={{ mt: 1, fontSize: isNarrow ? 13 : 14, display: '-webkit-box', WebkitLineClamp: isNarrow ? 3 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.detail}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <IconButton size="small" aria-label="more">
                                <MoreHorizIcon />
                              </IconButton>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
