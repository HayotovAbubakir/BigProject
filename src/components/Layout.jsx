import React, { memo, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Box, IconButton, useTheme, useMediaQuery, Avatar, Menu, MenuItem, Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountCircleIcon,
  Brightness4 as Brightness4Icon,
  Brightness7 as Brightness7Icon,
  Dashboard as DashboardIcon,
  Warehouse as WarehouseIcon,
  Storefront as StorefrontIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  ReceiptLong as ReceiptLongIcon,
  People as PeopleIcon,
  Language as LanguageIcon,
  AttachMoney as AttachMoneyIcon,
  Calculate as CalculateIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';

import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import { ThemeModeContext } from '../context/ThemeModeContext';
import useDisplayCurrency from '../hooks/useDisplayCurrency';
import CurrencyConverter from './CurrencyConverter';
import AccountManager from './AccountManager';
import Notifications from './Notifications';
import ContactDialog from './ContactDialog';
import AiAssistantDialog from './AiAssistantDialog';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';

const navItems = [
  { to: '/', key: 'dashboard', icon: <DashboardIcon /> },
  { to: '/warehouse', key: 'warehouse', icon: <WarehouseIcon /> },
  { to: '/store', key: 'store', icon: <StorefrontIcon /> },
  { to: '/clients', key: 'clients', icon: <PeopleIcon /> },
  { to: '/accounts', key: 'accounts', icon: <AccountBalanceWalletIcon /> },
  { to: '/logs', key: 'logs', icon: <ReceiptLongIcon /> },
  { to: '/calculator', key: 'calculator', icon: <CalculateIcon /> },
];

const UserMenu = memo(function UserMenu({ user, onLogout, onManageAccount, onContact }) {
  const { t } = useLocale();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = useCallback((event) => setAnchorEl(event.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);
  const handleManageAccountClick = useCallback(() => {
    handleClose();
    onManageAccount();
  }, [handleClose, onManageAccount]);
  const handleContactClick = useCallback(() => {
    handleClose();
    onContact();
  }, [handleClose, onContact]);
  const handleLogoutClick = useCallback(() => {
    handleClose();
    onLogout();
  }, [handleClose, onLogout]);

  return (
    <>
      <Tooltip title={user?.username || t('account') || ''}>
        <IconButton onClick={handleClick} size="small">
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
            <AccountCircleIcon />
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
      <MenuItem onClick={handleManageAccountClick}>{user?.username || t('account') || ''}</MenuItem>
      <MenuItem onClick={handleContactClick}>
        <ListItemText>{t('contact') || 'Contact'}</ListItemText>
      </MenuItem>
      <MenuItem onClick={handleLogoutClick}>
        <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
        <ListItemText>{t('logout') || ''}</ListItemText>
      </MenuItem>
      </Menu>
    </>
  );
});

const DrawerContent = memo(function DrawerContent({ navItems }) {
  return (
    <List sx={{ p: 1 }}>
      {navItems.map((item) => (
        <ListItemButton
          key={item.to}
          component={NavLink}
          to={item.to}
          end={item.to === '/'}
          sx={{
            borderRadius: 2,
            mb: 0.5,
            '&.active': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '& .MuiListItemIcon-root': {
                color: 'primary.contrastText',
              },
            },
          }}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );
});

export default function Layout({ children }) {
  const { logout, user } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { isDarkMode, setIsDarkMode } = useContext(ThemeModeContext);
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountManagerOpen, setAccountManagerOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  const drawerWidth = 240;

  const handleDrawerToggle = useCallback(() => setMobileOpen((prev) => !prev), []);

  const translatedNavItems = useMemo(
    () => navItems.map((item) => ({ ...item, label: t(item.key) || item.key })),
    [t],
  );

  const drawer = useMemo(() => <DrawerContent navItems={translatedNavItems} />, [translatedNavItems]);

  const currentRole = (user?.role || '').toLowerCase();
  const isDeveloper = currentRole === 'developer';
  const isAdmin = currentRole === 'admin';
  const canOpenAccountSettings = isDeveloper || isAdmin;
  // Check if user is restricted
  const isRestricted = user?.permissions?.new_account_restriction ?? false;

  const handleManageAccount = useCallback(() => {
    if (!canOpenAccountSettings) {
      window.alert(t('admin_only') || "Bu bo'lim faqat admin va developerlar uchun");
      return;
    }
    if (isRestricted && !isDeveloper) {
      window.alert(t('new_account_restriction_message') || 'Yangi qo\'shilgan akkauntlar bu amal\'ni bajarolmaslari mumkin');
      return;
    }
    setAccountManagerOpen(true);
  }, [canOpenAccountSettings, isRestricted, isDeveloper, t]);

  const handleToggleLanguage = useCallback(() => {
    const currentIndex = SUPPORTED_LANGUAGES.indexOf(locale);
    const next = SUPPORTED_LANGUAGES[(currentIndex + 1) % SUPPORTED_LANGUAGES.length];
    setLocale(next);
  }, [locale, setLocale]);

  const handleCurrencyToggle = useCallback(() => {
    setDisplayCurrency(displayCurrency === 'USD' ? 'UZS' : 'USD');
  }, [displayCurrency, setDisplayCurrency]);

  const handleAiAssistantOpen = useCallback(() => setAiAssistantOpen(true), []);
  const handleContactOpen = useCallback(() => setContactOpen(true), []);
  const handleAccountManagerClose = useCallback(() => setAccountManagerOpen(false), []);
  const handleContactClose = useCallback(() => setContactOpen(false), []);
  const handleAiAssistantClose = useCallback(() => setAiAssistantOpen(false), []);
  const handleThemeToggle = useCallback(() => setIsDarkMode((prev) => !prev), [setIsDarkMode]);


  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, minWidth: 0 }}>
            {t('appTitle')}
          </Typography>

          <Tooltip title={t('toggleLanguage') || ''}>
            <IconButton color="inherit" onClick={handleToggleLanguage}>
              <LanguageIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title={t('displayCurrencyToggle', { currency: displayCurrency === 'USD' ? 'UZS' : 'USD' }) || ''}>
            <IconButton color="inherit" onClick={handleCurrencyToggle}>
              <AttachMoneyIcon />
            </IconButton>
          </Tooltip>

          <CurrencyConverter />

          <Tooltip title="AI Operator">
            <IconButton color="inherit" onClick={handleAiAssistantOpen}>
              <SmartToyIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title={isDarkMode ? t('lightMode') || '' : t('darkMode') || ''}>
            <IconButton color="inherit" onClick={handleThemeToggle}>
              {isDarkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>

          <Notifications />

          <UserMenu
            user={user}
            onLogout={logout}
            onManageAccount={handleManageAccount}
            onContact={handleContactOpen}
          />
        </Toolbar>
      </AppBar>
      
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? "temporary" : "permanent"}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        key={location.pathname}
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          animation: 'fadeIn 0.5s ease-in-out',
          '@keyframes fadeIn': {
            '0%': { opacity: 0, transform: 'translateY(10px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        <Toolbar />
        {children}
      </Box>
      <AccountManager open={accountManagerOpen} onClose={handleAccountManagerClose} />
      <ContactDialog open={contactOpen} onClose={handleContactClose} />
      <AiAssistantDialog open={aiAssistantOpen} onClose={handleAiAssistantClose} />
      
      <Box component="footer" sx={{ position: 'fixed', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <Box sx={{ bgcolor: 'background.paper', color: 'text.secondary', px: 2, py: 0.5, borderRadius: 4, boxShadow: 2, pointerEvents: 'auto' }}>
          {t('footer_credit') || 'by Khayotov Abubakir'}
        </Box>
      </Box>

    </Box>
  );
}
