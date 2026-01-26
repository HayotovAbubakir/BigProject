import React, { useState, useContext } from 'react';
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
} from '@mui/icons-material';

import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../context/LocaleContext';
import { ThemeModeContext } from '../context/ThemeModeContext';
import useDisplayCurrency from '../hooks/useDisplayCurrency';
import CurrencyConverter from './CurrencyConverter';
import AccountManager from './AccountManager';
import Notifications from './Notifications';

const navItems = [
  { to: '/', key: 'dashboard', icon: <DashboardIcon /> },
  { to: '/warehouse', key: 'warehouse', icon: <WarehouseIcon /> },
  { to: '/store', key: 'store', icon: <StorefrontIcon /> },
  { to: '/clients', key: 'clients', icon: <PeopleIcon /> },
  { to: '/accounts', key: 'accounts', icon: <AccountBalanceWalletIcon /> },
  { to: '/logs', key: 'logs', icon: <ReceiptLongIcon /> },
  { to: '/calculator', key: 'calculator', icon: <CalculateIcon /> },
];

function UserMenu({ user, onLogout, onManageAccount }) {
  const { t } = useLocale();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

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
        <MenuItem onClick={() => { handleClose(); onManageAccount(); }}>{user?.username || t('account') || ''}</MenuItem>
        <MenuItem onClick={() => { handleClose(); onLogout(); }}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('logout') || ''}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

function DrawerContent({ navItems, t }) {
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
          <ListItemText primary={t(item.key) || item.key} />
        </ListItemButton>
      ))}
    </List>
  );
}

export default function Layout({ children }) {
  const { logout, user, hasPermission } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const { isDarkMode, setIsDarkMode } = useContext(ThemeModeContext);
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountManagerOpen, setAccountManagerOpen] = useState(false);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  const drawerWidth = 240;

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const translatedNavItems = navItems.map(n => ({ ...n, label: t(n.key) || n.key }));

  const drawer = <DrawerContent navItems={translatedNavItems} t={t} />;

  // Check if user is restricted
  const isRestricted = user?.permissions?.new_account_restriction ?? false;

  const handleManageAccount = () => {
    if (isRestricted) {
      window.alert(t('new_account_restriction_message') || 'Yangi qo\'shilgan akkauntlar bu amal\'ni bajarolmaslari mumkin');
      return;
    }
    setAccountManagerOpen(true);
  };

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
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {t('appTitle')}
          </Typography>

          <Tooltip title={t('toggleLanguage') || ''}>
            <IconButton color="inherit" onClick={() => setLocale(locale === 'uz' ? 'en' : 'uz')}>
              <LanguageIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title={t('displayCurrencyToggle', { currency: displayCurrency === 'USD' ? 'UZS' : 'USD' }) || ''}>
            <IconButton color="inherit" onClick={() => setDisplayCurrency(displayCurrency === 'USD' ? 'UZS' : 'USD')}>
              <AttachMoneyIcon />
            </IconButton>
          </Tooltip>

          <CurrencyConverter />

          <Tooltip title={isDarkMode ? t('lightMode') || '' : t('darkMode') || ''}>
            <IconButton color="inherit" onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>

          <Notifications />

          <UserMenu
            user={user}
            onLogout={logout}
            onManageAccount={handleManageAccount}
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
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
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
      <AccountManager open={accountManagerOpen} onClose={() => setAccountManagerOpen(false)} />
      
    </Box>
  );
}