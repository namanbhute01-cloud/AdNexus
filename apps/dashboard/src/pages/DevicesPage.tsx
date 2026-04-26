import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../lib/api';
import { mockDevices } from '../data/mock';
import { DeviceGrid } from '../components/device/DeviceGrid';

export const DevicesPage = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'MAINTENANCE'>('ALL');
  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: dashboardApi.getDevices });
  const devices = devicesQuery.data ?? mockDevices;

  return (
    <section className="stack">
      <div className="row-gap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search serial" />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="ALL">All</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
      </div>
      <DeviceGrid devices={devices} search={search} status={status} />
    </section>
  );
};

