
import React, { useCallback, useMemo, useState } from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsModal from './NotificationsModal';
import { useApp } from '../context/useApp';
import { isMeterCategory } from '../utils/productCategories';

const jokes = [
    "Savdo yaxshi bo'lsa, kayfiyat ham a'lo bo'ladi!",
    "Har bir sotilgan mahsulot - bu bir tabassum!",
    "Ombor to'la bo'lsa, ko'ngil to'q bo'ladi!",
];

const Notifications = () => {
    const [open, setOpen] = useState(false);
    const { state } = useApp();

    const notifications = useMemo(() => {
        const now = Date.now();
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const lowStock = [];
        const overdueCredits = [];

        const collectLowStock = (items = [], suffix = '') => {
            items.forEach((product, index) => {
                const isMeter = isMeterCategory(product);
                const meterQty = Number(product?.meter_qty ?? (Number(product?.pack_qty || 0) * Number(product?.qty || 0)));
                const qtyValue = isMeter ? meterQty : Number(product?.qty || 0);
                if (qtyValue >= 5) return;

                lowStock.push({
                    type: 'low_stock',
                    message: `${product.name}${suffix} kam qoldi (${isMeter ? `${qtyValue} m` : `${qtyValue} ta`})!`,
                    joke: jokes[index % jokes.length],
                    item: product
                });
            });
        };

        collectLowStock(state.warehouse);
        collectLowStock(state.store, " do'konda");

        (state.credits || []).forEach((credit) => {
            const creditDate = new Date(credit.date).getTime();
            if ((Number(credit.remaining) || 0) > 0 && creditDate < weekAgo) {
                overdueCredits.push({
                    type: 'overdue_credit',
                    message: `${credit.name} ga berilgan nasiya muddati o'tib ketdi!`,
                    item: credit
                });
            }
        });

        return [...lowStock, ...overdueCredits];
    }, [state.warehouse, state.store, state.credits]);

    const handleOpen = useCallback(() => setOpen(true), []);
    const handleClose = useCallback(() => setOpen(false), []);

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

export default React.memo(Notifications);
