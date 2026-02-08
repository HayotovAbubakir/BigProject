import { createTheme, responsiveFontSizes } from '@mui/material/styles';

// --- Base Settings ---
const baseTheme = {
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily: "'Sora', 'IBM Plex Sans', sans-serif",
    h1: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: '3.25rem' },
    h2: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: '2.7rem' },
    h3: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: '2.2rem' },
    h4: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: '1.9rem' },
    h5: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: '1.5rem' },
    h6: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: '1.25rem' },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.3px',
    },
  },
};

// --- Light Theme ---
export let lightTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'light',
    primary: { main: '#2C7A7B' },
    secondary: { main: '#C8A46B' },
    background: {
      default: '#F8F5F0',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1B1F24',
      secondary: '#5B6570',
    },
    divider: 'rgba(15, 23, 42, 0.08)',
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
          backgroundColor: 'rgba(255, 255, 255, 0.78)',
          color: '#1B1F24',
          backdropFilter: 'saturate(200%) blur(10px)',
          borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
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
          boxShadow: '0 10px 22px rgba(15, 23, 42, 0.1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 16px 30px rgba(15, 23, 42, 0.14)',
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
    primary: { main: '#7EC6C0' },
    secondary: { main: '#D2B37B' },
    background: {
      default: '#0F1215',
      paper: '#151A1F',
    },
    text: {
      primary: '#E6E9EC',
      secondary: '#A1A8B0',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
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
          backgroundColor: 'rgba(15, 18, 21, 0.78)',
          backdropFilter: 'saturate(200%) blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
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
          boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
          backgroundImage: 'none', // override potential inherited gradients
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 18px 34px rgba(0,0,0,0.48)',
          },
        },
      },
    },
  },
});

// Apply responsive font sizes
lightTheme = responsiveFontSizes(lightTheme);
darkTheme = responsiveFontSizes(darkTheme);
