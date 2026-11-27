import { io } from 'socket.io-client';

// Sockets bypass the Vercel rewrite (it can't proxy WebSockets), so production sets
// VITE_SOCKET_URL to the API host. Locally the Vite dev server proxies /socket.io.
const URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || undefined;

let socket = null;
let currentToken = null;

export function connectSocket(token) {
  if (socket && currentToken === token) return socket;
  socket?.disconnect();
  currentToken = token;
  socket = io(URL, { auth: token ? { token } : {}, transports: ['websocket', 'polling'] });
  return socket;
}

export function getSocket() {
  return socket ?? connectSocket(null);
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = null;
}
