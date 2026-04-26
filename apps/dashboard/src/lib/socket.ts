import { io } from 'socket.io-client';

const base = process.env.REACT_APP_WS_URL || 'http://localhost:3000';
export const liveSocket = io(`${base}/live`, {
  autoConnect: true,
  transports: ['websocket'],
});

