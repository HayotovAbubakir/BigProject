import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  Typography,
  Box,
  Chip
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { Inventory2, LocalFireDepartment, NewReleases } from '@mui/icons-material';
import { isMeterCategory } from '../utils/productCategories';

const getPoem = () => {
  const poems = [
    "Omborda mol kamaydi,\nSavdo-sotiq to'xtaydi.\nXaridorlar xafadir,\nChunki mahsulot adodir.",
    "Nasiya daftar yig'lar,\nVaqt o'tganini so'ylar.\nQaytmasa agar mablag',\nDo'stlik ipi uzilar."
  ];
  return poems[Math.floor(Math.random() * poems.length)];
};

const NotificationsModal = React.memo(function NotificationsModal({ open, handleClose, notifications }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const bgSurface = theme.palette.background.paper;
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const headerBorder = alpha(theme.palette.divider, 0.6);
  const bodyBorder = alpha(theme.palette.divider, 0.9);
  const listItemBg = isDark ? alpha('#0f172a', 0.8) : alpha('#f8fafc', 1);
  const listItemBorder = bodyBorder;
  const listItemHover = isDark ? alpha('#1f2937', 0.9) : alpha('#f9fafb', 1);
  const iconColor = textSecondary;
  const summary = useMemo(() => {
    const lowStock = notifications.filter((n) => n.type === 'low_stock').length;
    const overdue = notifications.filter((n) => n.type === 'overdue_credit').length;
    return { total: notifications.length, lowStock, overdue };
  }, [notifications]);

  const sortedNotifications = useMemo(() => {
    const priority = (n) => (n.type === 'overdue_credit' ? 0 : 1);
    return [...notifications].sort((a, b) => {
      const pA = priority(a);
      const pB = priority(b);
      if (pA !== pB) return pA - pB;
      if (a.type === 'low_stock' && b.type === 'low_stock') {
        const aItem = a?.item;
        const bItem = b?.item;
        const aIsMeter = isMeterCategory(aItem);
        const bIsMeter = isMeterCategory(bItem);
        const aQty = aIsMeter
          ? Number(aItem?.meter_qty ?? (Number(aItem?.pack_qty || 0) * Number(aItem?.qty || 0)))
          : Number(aItem?.qty ?? Number.POSITIVE_INFINITY);
        const bQty = bIsMeter
          ? Number(bItem?.meter_qty ?? (Number(bItem?.pack_qty || 0) * Number(bItem?.qty || 0)))
          : Number(bItem?.qty ?? Number.POSITIVE_INFINITY);
        return aQty - bQty;
      }
      return 0;
    });
  }, [notifications]);

  const lastUpdated = new Date().toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: { xs: 3, sm: 4 },
          overflow: 'hidden',
          bgcolor: bgSurface,
          color: textPrimary,
          border: `1px solid ${bodyBorder}`,
          boxShadow: '0 30px 60px rgba(0,0,0,0.18)'
        }
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            position: 'relative',
            px: { xs: 2.5, sm: 3 },
            py: { xs: 2.5, sm: 3 },
            color: textPrimary,
            background: bgSurface,
            borderBottom: `1px solid ${headerBorder}`
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 2,
              position: 'relative',
              zIndex: 1
            }}
          >
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 600,
                  letterSpacing: '0.2px'
                }}
              >
                Premium Ogohlantirishlar
              </Typography>
              <Typography variant="body2" sx={{ color: textSecondary }}>
                Aql bilan saralangan signal markazi
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: 0.25,
              background: 'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.65), transparent 60%)'
            }}
          />
        </Box>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          bgcolor: bgSurface,
          color: textPrimary,
          borderColor: headerBorder,
          px: { xs: 2.5, sm: 3 },
          py: { xs: 2.5, sm: 3 }
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 1.5,
            mb: 2.5
          }}
        >
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: isDark ? '#111827' : '#f9fafb',
              border: `1px solid ${bodyBorder}`
            }}
          >
            <Typography variant="caption" sx={{ color: textSecondary }}>
              Jami
            </Typography>
            <Typography variant="h6" sx={{ color: textPrimary, fontWeight: 600 }}>
              {summary.total}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
              border: isDark ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(245, 158, 11, 0.2)'
            }}
          >
            <Typography variant="caption" sx={{ color: isDark ? '#fde68a' : '#92400e' }}>
              Kam qoldi
            </Typography>
            <Typography variant="h6" sx={{ color: isDark ? '#fde68a' : '#b45309', fontWeight: 600 }}>
              {summary.lowStock}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
              border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            <Typography variant="caption" sx={{ color: isDark ? '#fca5a5' : '#991b1b' }}>
              Muddati o'tgan
            </Typography>
            <Typography variant="h6" sx={{ color: isDark ? '#fca5a5' : '#b91c1c', fontWeight: 600 }}>
              {summary.overdue}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            background: isDark ? '#111827' : '#f9fafb',
            border: `1px dashed ${bodyBorder}`
          }}
        >
          <NewReleases sx={{ color: isDark ? '#fde68a' : '#b45309' }} />
          <Box>
            <Typography variant="subtitle2" sx={{ color: textPrimary, fontWeight: 600 }}>
              Yangilik: aqlli tartiblash
            </Typography>
            <Typography variant="caption" sx={{ color: textSecondary }}>
              Avval muddati o'tganlar ko'rsatiladi. Yangilandi: {lastUpdated}
            </Typography>
          </Box>
        </Box>

        {sortedNotifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ color: textPrimary }}>
              Hozircha ogohlantirish yo'q
            </Typography>
            <Typography variant="body2" sx={{ color: textSecondary }}>
              Hammasi nazorat ostida. Dam olishingiz mumkin.
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {sortedNotifications.map((n, idx) => {
              const isOverdue = n.type === 'overdue_credit';
              const accent = isOverdue ? '#F87171' : '#FBBF24';
              const title = isOverdue ? "Nasiya muddati o'tgan" : 'Mahsulot kam qoldi';
              const icon = isOverdue ? <LocalFireDepartment /> : <Inventory2 />;

              return (
                <ListItem
                  key={idx}
                  sx={{
                    mb: 1.5,
                    borderRadius: 2.5,
                    p: 2,
                    bgcolor: listItemBg,
                    border: `1px solid ${listItemBorder}`,
                    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.12)',
                    position: 'relative',
                    overflow: 'hidden',
                    color: textPrimary,
                    transition: 'background-color 0.2s ease',
                    '&:hover': { backgroundColor: listItemHover }
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0.15,
                      background: `linear-gradient(120deg, ${accent}, transparent 65%)`
                    }}
                  />
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, width: '100%', position: 'relative', zIndex: 1 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: iconColor,
                          background: isDark ? '#111827' : '#f3f4f6',
                          boxShadow: `0 10px 20px ${accent}26`
                        }}
                      >
                      {React.cloneElement(icon, { sx: { color: iconColor } })}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle1" sx={{ color: textPrimary, fontWeight: 600 }}>
                            {title}
                          </Typography>
                          <Chip
                            size="small"
                            label={isOverdue ? 'Critical' : 'Attention'}
                            sx={{
                            bgcolor: isOverdue
                              ? (isDark ? 'rgba(248,113,113,0.25)' : 'rgba(248,113,113,0.18)')
                              : (isDark ? 'rgba(251,191,36,0.25)' : 'rgba(251,191,36,0.18)'),
                            color: isOverdue ? '#ef4444' : '#f59e0b',
                            fontWeight: 600
                          }}
                          />
                        </Box>
                      <Typography variant="body2" sx={{ color: textPrimary }}>
                        {n.message}
                      </Typography>
                      {n.item?.qty != null && !isOverdue && (
                        <Typography variant="caption" sx={{ color: textSecondary, display: 'block', mt: 0.5 }}>
                          {isMeterCategory(n.item)
                            ? `Qolgan metr: ${Number(n.item?.meter_qty ?? (Number(n.item?.pack_qty || 0) * Number(n.item?.qty || 0)))} m`
                            : `Qolgan miqdor: ${n.item.qty}`
                          }
                        </Typography>
                      )}
                      {n.item?.remaining != null && isOverdue && (
                        <Typography variant="caption" sx={{ color: textSecondary, display: 'block', mt: 0.5 }}>
                          Qolgan summa: {n.item.remaining}
                        </Typography>
                      )}
                      {n.joke && (
                        <Typography
                          variant="caption"
                          sx={{ fontStyle: 'italic', display: 'block', mt: 1, color: textSecondary }}
                        >
                          {n.joke}
                        </Typography>
                      )}
                      {isOverdue && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontStyle: 'italic',
                            display: 'block',
                            mt: 1,
                            color: textSecondary,
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {getPoem()}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 2.5, sm: 3 },
          py: 2,
          background: bgSurface,
          borderTop: `1px solid ${headerBorder}`
        }}
      >
        <Button
          onClick={handleClose}
          variant="contained"
          sx={{
            px: 3,
            borderRadius: 2,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)',
            boxShadow: '0 12px 24px rgba(14, 165, 233, 0.35)'
          }}
        >
          Yopish
        </Button>
      </DialogActions>
    </Dialog>
  );
});

export default NotificationsModal;
