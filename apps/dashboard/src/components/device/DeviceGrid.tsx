import { Device } from '../../types';
import { DeviceCard } from './DeviceCard';

type Props = {
  devices: Device[];
  search: string;
  status: 'ALL' | 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
};

export const DeviceGrid = ({ devices, search, status }: Props) => {
  const filtered = devices.filter((device) => {
    const bySearch = device.serial_number.toLowerCase().includes(search.toLowerCase());
    const byStatus = status === 'ALL' || device.status === status;
    return bySearch && byStatus;
  });

  return (
    <div className="grid grid-3">
      {filtered.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </div>
  );
};

