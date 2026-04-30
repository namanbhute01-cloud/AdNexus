import { io, Socket } from 'socket.io-client';

const wsBase = (process.env.REACT_APP_WS_URL || 'http://localhost:3000').replace(/^ws:/, 'http:');

export const liveSocket = io(`${wsBase}/live`, {
  autoConnect: true,
  transports: ['websocket'],
});

export function createAdNexusSocket(token: string): Socket {
  return io(`${wsBase}/adnexus`, {
    autoConnect: true,
    transports: ['websocket'],
    auth: { token },
  });
}
