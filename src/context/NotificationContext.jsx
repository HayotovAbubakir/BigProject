import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, AlertTitle } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';

const NotificationContext = createContext(undefined);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const notify = useCallback((title, message, severity = 'info') => {
    const id = uuidv4();
    setNotifications((prev) => [...prev, { id, title, message, severity }]);
  }, []);

  const hideNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {notifications.map((n, index) => (
        <Snackbar
          key={n.id}
          open
          autoHideDuration={6000}
          onClose={() => hideNotification(n.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          style={{ bottom: `${index * 65 + 20}px` }}
        >
          <Alert onClose={() => hideNotification(n.id)} severity={n.severity} sx={{ width: '100%' }}>
            <AlertTitle>{n.title}</AlertTitle>
            {n.message}
          </Alert>
        </Snackbar>
      ))}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}