import { io } from 'socket.io-client';

const SOCKET_URL = window.location.port === '5173' ? 'http://localhost:5000' : '/';

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
