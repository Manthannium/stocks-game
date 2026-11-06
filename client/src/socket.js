import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 700,
  reconnectionDelayMax: 5000
});

// Works with server handlers that acknowledge through Socket.IO's callback.
export function emitWithAck(eventName, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error("Not connected to the game server."));
      return;
    }

    socket.timeout(8000).emit(eventName, payload, (error, response) => {
      if (error) {
        reject(new Error("The server did not respond. Please try again."));
        return;
      }

      if (response?.success === false) {
        reject(new Error(response.error || "Action failed."));
        return;
      }

      resolve(response || { success: true });
    });
  });
}

socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('Socket connection failed:', error.message);
});

socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
});





