
import React, { useState, useEffect } from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsModal from './NotificationsModal';
import { useApp } from '../context/useApp';

const jokes = [
    "Savdo yaxshi bo'lsa, kayfiyat ham a'lo bo'ladi!",
    "Har bir sotilgan mahsulot - bu bir tabassum!",
    "Ombor to'la bo'lsa, ko'ngil to'q bo'ladi!",
];

const Notifications = () => {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const { state } = useApp();

    useEffect(() => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const lowStock = [];
        const overdueCredits = [];

        // Low stock: qty < 5
        state.warehouse?.forEach(p => {
            if (p.qty < 5) {
                const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
                lowStock.push({
                    type: 'low_stock',
                    message: `${p.name} kam qoldi (${p.qty} ta)!`,
                    joke: randomJoke,
                    item: p
                });
            }
        });

        state.store?.forEach(p => {
            if (p.qty < 5) {
                const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
                lowStock.push({
                    type: 'low_stock',
                    message: `${p.name} do'konda kam qoldi (${p.qty} ta)!`,
                    joke: randomJoke,
                    item: p
                });
            }
        });

        // Overdue credits: date > 1 week ago and remaining > 0
        state.credits?.forEach(c => {
            if (c.remaining > 0 && new Date(c.date) < weekAgo) {
                overdueCredits.push({
                    type: 'overdue_credit',
                    message: `${c.name} ga berilgan nasiya muddati o'tib ketdi!`,
                    item: c
                });
            }
        });

        setNotifications([...lowStock, ...overdueCredits]);
    }, [state.warehouse, state.store, state.credits]);

    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <>
            <Tooltip title="Notifications">
                <IconButton color="inherit" onClick={handleOpen}>
                    <Badge badgeContent={notifications.length} color="error">
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
            </Tooltip>
            <NotificationsModal
                open={open}
                handleClose={handleClose}
                notifications={notifications}
            />
        </>
    );
};

export default Notifications;
