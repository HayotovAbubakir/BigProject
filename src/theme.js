import { createTheme, responsiveFontSizes } from '@mui/material/styles'

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0b84ff', contrastText: '#fff' },
    secondary: { main: '#ffb400' },
    background: { default: '#f6f9fc', paper: '#ffffff' },
    success: { main: '#28a745' },
    error: { main: '#e53935' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "Inter, Roboto, 'Helvetica Neue', Arial",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { height: '100%', width: '100%' },
        body: { backgroundColor: '#f6f9fc' }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backdropFilter: 'saturate(180%) blur(6px)', backgroundColor: 'rgba(11,132,255,0.95)' }
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingLeft: 14,
          paddingRight: 14,
          transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
        },
        containedPrimary: {
          backgroundImage: 'linear-gradient(90deg, #0b84ff 0%, #0b6bff 100%)',
          color: '#fff',
          boxShadow: '0 6px 18px rgba(11,132,255,0.12)',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 30px rgba(11,132,255,0.16)' },
          '&:active': { transform: 'translateY(0)', boxShadow: '0 4px 12px rgba(11,132,255,0.08)' }
        },
        outlined: {
          borderWidth: 1,
          borderColor: 'rgba(16,24,40,0.06)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 6px 18px rgba(16,24,40,0.06)',
          border: '1px solid rgba(16,24,40,0.03)'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundClip: 'padding-box' }
      }
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { borderRadius: 8, fontSize: '0.85rem' } }
    }
  }
})

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#2196f3', contrastText: '#fff' },
    secondary: { main: '#ffb400' },
    background: { default: '#121212', paper: '#1e1e1e' },
    success: { main: '#4caf50' },
    error: { main: '#f44336' },
    text: { primary: '#e0e0e0', secondary: '#b0b0b0' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "Inter, Roboto, 'Helvetica Neue', Arial",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        'html, body, #root': { height: '100%', width: '100%' },
        body: { backgroundColor: '#121212' }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backdropFilter: 'saturate(180%) blur(6px)', backgroundColor: 'rgba(60,60,60,0.95)' }
      }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingLeft: 14,
          paddingRight: 14,
          transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
        },
        containedPrimary: {
          backgroundImage: 'linear-gradient(90deg, #2196f3 0%, #1976d2 100%)',
          color: '#fff',
          boxShadow: '0 6px 18px rgba(33,150,243,0.12)',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 30px rgba(33,150,243,0.16)' },
          '&:active': { transform: 'translateY(0)', boxShadow: '0 4px 12px rgba(33,150,243,0.08)' }
        },
        outlined: {
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 6px 18px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.05)'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundClip: 'padding-box' }
      }
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { borderRadius: 8, fontSize: '0.85rem' } }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: '#1e1e1e' }
      }
    }
  }
})

let theme = lightTheme
theme = responsiveFontSizes(theme)

export default theme
