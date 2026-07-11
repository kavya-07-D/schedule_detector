import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  message: string;
  type: 'INFO' | 'ALERT' | 'SUCCESS';
  createdAt: string;
}

interface SocketContextType {
  socket: Socket | null;
  notifications: AppNotification[];
  refreshNotifications: () => Promise<void>;
  addToast: (message: string, type: 'INFO' | 'ALERT' | 'SUCCESS') => void;
  toasts: Array<{ id: string; message: string; type: 'INFO' | 'ALERT' | 'SUCCESS' }>;
  removeToast: (id: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'INFO' | 'ALERT' | 'SUCCESS' }>>([]);

  const addToast = (message: string, type: 'INFO' | 'ALERT' | 'SUCCESS') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const refreshNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  };

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl = 'http://localhost:5000';
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    setSocket(newSocket);
    refreshNotifications();

    newSocket.on('connect', () => {
      console.log('Socket client connected to backend');
    });

    newSocket.on('notification', (data: { message: string; type: 'INFO' | 'ALERT' | 'SUCCESS' }) => {
      addToast(data.message, data.type);
      refreshNotifications(); // fetch latest persistent notification records
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, notifications, refreshNotifications, addToast, toasts, removeToast }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
