import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim() || undefined;

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

export function registerUser(userId, role) {
  if (socket.connected) {
    socket.emit('user:register', { userId, role });
  } else {
    socket.once('connect', () => {
      socket.emit('user:register', { userId, role });
    });
  }
}
