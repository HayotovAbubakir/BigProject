
import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, Typography, Box, Chip
} from '@mui/material';
import { Warning, ErrorOutline, Celebration, Storefront, MonetizationOn } from '@mui/icons-material';

const getPoem = () => {
    const poems = [
        "Omborda mol kamaydi,\nSavdo-sotiq to'xtaydi.\nXaridorlar xafadir,\nChunki mahsulot adodir.",
        "Nasiya daftar yig'lar,\nVaqt o'tganini so'ylar.\nQaytmasa agar mablag',\nDo'stlik ipi uzilar."
    ];
    return poems[Math.floor(Math.random() * poems.length)];
}

const NotificationsModal = ({ open, handleClose, notifications }) => {
    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{
                textAlign: 'center',
                fontWeight: 'bold',
                background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
                color: 'white',
                padding: '16px 24px',
            }}>
                <Celebration sx={{ verticalAlign: 'middle', mr: 1 }} />
                Bizni kutib oling!
            </DialogTitle>
            <DialogContent dividers>
                {notifications.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="h6" gutterBottom>
                            🎉 Hech qanday ogohlantirish yo'q!
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                           Dam olishingiz mumkin, hammasi joyida.
                        </Typography>
                    </Box>
                ) : (
                    <List>
                        {notifications.map((n, idx) => (
                            <ListItem key={idx} sx={{
                                mb: 1,
                                bgcolor: 'background.paper',
                                borderRadius: 2,
                                p: 2,
                                boxShadow: 1,
                                borderLeft: `5px solid ${n.type === 'low_stock' ? '#ff9800' : '#f44336'}`
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                    {n.type === 'low_stock' ? <Warning color="warning" /> : <ErrorOutline color="error" />}
                                    <Box>
                                        <Typography variant="subtitle1" component="div">
                                            {n.type === 'low_stock' ? 'Mahsulot kam qoldi' : "Nasiya muddati o'tdi"}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">{n.message}</Typography>
                                        {n.joke && (
                                             <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block', mt: 1 }}>
                                                {n.joke}
                                             </Typography>
                                        )}
                                        {n.type === 'overdue_credit' && (
                                            <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block', mt: 1 }}>
                                               {getPoem()}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} variant="contained" color="primary">
                    Yopish
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default NotificationsModal;
