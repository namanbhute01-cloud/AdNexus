import { useEffect, useState } from 'react';
import { AlertItem, Telemetry } from '../types';
import { liveSocket } from '../lib/socket';
import { mockAlerts, mockTelemetry } from '../data/mock';

export const useLiveFeed = () => {
  const [telemetry, setTelemetry] = useState<Telemetry>(mockTelemetry);
  const [alerts, setAlerts] = useState<AlertItem[]>(mockAlerts);

  useEffect(() => {
    const onTelemetry = (payload: Record<string, unknown>) => {
      setTelemetry((prev) => ({
        cpu: String(payload.cpu ?? prev.cpu),
        ram: String(payload.ram ?? prev.ram),
        disk: String(payload.disk ?? prev.disk),
        network: String(payload.network ?? prev.network),
        lastUpdate: 'live',
      }));
    };

    const onAlert = (payload: Record<string, unknown>) => {
      const item: AlertItem = {
        id: crypto.randomUUID(),
        message: String(payload.message ?? payload.type ?? 'Fleet alert'),
        createdAt: 'just now',
      };
      setAlerts((prev) => [item, ...prev].slice(0, 10));
    };

    liveSocket.on('device:telemetry', onTelemetry);
    liveSocket.on('fleet:alert', onAlert);
    return () => {
      liveSocket.off('device:telemetry', onTelemetry);
      liveSocket.off('fleet:alert', onAlert);
    };
  }, []);

  return { telemetry, alerts };
};
