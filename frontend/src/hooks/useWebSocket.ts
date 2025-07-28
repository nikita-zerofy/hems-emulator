import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SimulationUpdate } from '../types';


// @ts-ignore
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// Convert HTTP(S) URL to WebSocket URL
const WS_URL = import.meta.env.VITE_WS_URL || API_URL.replace(/^http/, 'ws');

export interface DwellingUpdate {
  dwellingId: string;
  deviceCount: number;
  timestamp: string;
  weatherData?: any;
}

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create socket connection
    socketRef.current = io(WS_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      setError(error.message);
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const joinDwelling = (dwellingId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-dwelling', dwellingId);
    }
  };

  const leaveDwelling = (dwellingId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-dwelling', dwellingId);
    }
  };

  const joinSimulation = () => {
    if (socketRef.current) {
      socketRef.current.emit('join-simulation');
    }
  };

  const leaveSimulation = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-simulation');
    }
  };

  const onSimulationUpdate = (callback: (update: SimulationUpdate) => void) => {
    if (socketRef.current) {
      socketRef.current.on('simulation-update', callback);
    }
  };

  const onDwellingUpdate = (callback: (update: DwellingUpdate) => void) => {
    if (socketRef.current) {
      socketRef.current.on('dwelling-update', callback);
    }
  };

  const offSimulationUpdate = (callback: (update: SimulationUpdate) => void) => {
    if (socketRef.current) {
      socketRef.current.off('simulation-update', callback);
    }
  };

  const offDwellingUpdate = (callback: (update: DwellingUpdate) => void) => {
    if (socketRef.current) {
      socketRef.current.off('dwelling-update', callback);
    }
  };

  return {
    isConnected,
    error,
    joinDwelling,
    leaveDwelling,
    joinSimulation,
    leaveSimulation,
    onSimulationUpdate,
    onDwellingUpdate,
    offSimulationUpdate,
    offDwellingUpdate,
  };
};

// Hook specifically for dwelling details page
export const useDwellingWebSocket = (dwellingId: string | undefined) => {
  const webSocket = useWebSocket();
  const [lastUpdate, setLastUpdate] = useState<SimulationUpdate | null>(null);

  useEffect(() => {
    if (!dwellingId || !webSocket.isConnected) return;

    // Join dwelling room
    webSocket.joinDwelling(dwellingId);

    // Set up simulation update listener
    const handleSimulationUpdate = (update: SimulationUpdate) => {
      if (update.dwellingId === dwellingId) {
        setLastUpdate(update);
      }
    };

    webSocket.onSimulationUpdate(handleSimulationUpdate);

    // Cleanup
    return () => {
      webSocket.offSimulationUpdate(handleSimulationUpdate);
      webSocket.leaveDwelling(dwellingId);
    };
  }, [dwellingId, webSocket.isConnected]);

  return {
    ...webSocket,
    lastUpdate,
  };
};

// Hook for dashboard page
export const useDashboardWebSocket = () => {
  const webSocket = useWebSocket();
  const [dwellingUpdates, setDwellingUpdates] = useState<Map<string, DwellingUpdate>>(new Map());

  useEffect(() => {
    if (!webSocket.isConnected) return;

    // Join simulation room for general updates
    webSocket.joinSimulation();

    // Set up dwelling update listener
    const handleDwellingUpdate = (update: DwellingUpdate) => {
      setDwellingUpdates(prev => {
        const newMap = new Map(prev);
        newMap.set(update.dwellingId, update);
        return newMap;
      });
    };

    webSocket.onDwellingUpdate(handleDwellingUpdate);

    // Cleanup
    return () => {
      webSocket.offDwellingUpdate(handleDwellingUpdate);
      webSocket.leaveSimulation();
    };
  }, [webSocket.isConnected]);

  return {
    ...webSocket,
    dwellingUpdates,
  };
}; 