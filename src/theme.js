import { createTheme, responsiveFontSizes } from '@mui/material/styles';

// --- Base Settings ---
const baseTheme = {
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h1: { fontWeight: 800, fontSize: '3.5rem' },
    h2: { fontWeight: 700, fontSize: '3rem' },
    h3: { fontWeight: 700, fontSize: '2.5rem' },
    h4: { fontWeight: 700, fontSize: '2rem' },
    h5: { fontWeight: 600, fontSize: '1.5rem' },
    h6: { fontWeight: 600, fontSize: '1.25rem' },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.5px',
    },
  },
};

// --- Light Theme ---
export let lightTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'light',
    primary: { main: '#007BFF' },
    secondary: { main: '#6F42C1' },
    background: {
      default: '#F8F9FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#212529',
      secondary: '#6C757D',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        body {
          transition: background-color 0.3s ease;
        }
        .page-enter {
          opacity: 0;
          transform: translateY(10px);
        }
        .page-enter-active {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 300ms, transform 300ms;
        }
      `,
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          color: '#212529',
          backdropFilter: 'saturate(200%) blur(10px)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.25s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          transition: 'all 0.3s ease-in-out',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
          },
        },
      },
    },
  },
});

// --- Dark Theme ---
export let darkTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'dark',
    primary: { main: '#3498DB' },
    secondary: { main: '#8E44AD' },
    background: {
      default: '#1C2833',
      paper: '#212F3D',
    },
    text: {
      primary: '#EAECEE',
      secondary: '#ABB2B9',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        body {
          transition: background-color 0.3s ease;
        }
        .page-enter {
          opacity: 0;
          transform: translateY(10px);
        }
        .page-enter-active {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 300ms, transform 300ms;
        }
      `,
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(28, 40, 51, 0.8)',
          backdropFilter: 'saturate(200%) blur(10px)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.25s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          transition: 'all 0.3s ease-in-out',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          backgroundImage: 'none', // override potential inherited gradients
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
          },
        },
      },
    },
  },
});

// Apply responsive font sizes
lightTheme = responsiveFontSizes(lightTheme);
darkTheme = responsiveFontSizes(darkTheme);