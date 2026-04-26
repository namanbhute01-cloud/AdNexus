import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../lib/api';
import { mockAlerts, mockDevices, mockFleetStats } from '../data/mock';
import { FleetSummary } from '../components/analytics/FleetSummary';
import { DeviceCard } from '../components/device/DeviceCard';
import { useLiveFeed } from '../hooks/useLiveFeed';

export const DashboardPage = () => {
  const statsQuery = useQuery({ queryKey: ['fleet-stats'], queryFn: dashboardApi.getFleetStats });
  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: dashboardApi.getDevices });
  const { alerts } = useLiveFeed();

  const stats = statsQuery.data ?? mockFleetStats;
  const devices = devicesQuery.data ?? mockDevices;

  return (
    <section className="stack">
      <FleetSummary online={stats.online} offline={stats.offline} alerts={stats.alerts} uptime={stats.uptimePercent} />
      <div className="card map-card">
        <h3>Live Fleet Map</h3>
        <div className="preview-frame" style={{ minHeight: 260 }}>
          Leaflet map placeholder · {devices.filter((item) => item.location).length} vehicle markers
        </div>
      </div>

      <div className="grid grid-3">
        {devices.slice(0, 3).map((device) => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      <div className="card stack">
        <h3>Recent Alerts</h3>
        {(alerts.length ? alerts : mockAlerts).map((item) => (
          <div key={item.id} className="row-between">
            <span>{item.message}</span>
            <span className="muted">{item.createdAt}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
