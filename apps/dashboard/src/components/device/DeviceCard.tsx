import { Link } from 'react-router-dom';
import { Device } from '../../types';
import { StatusDot } from '../common/StatusDot';

type Props = { device: Device };

export const DeviceCard = ({ device }: Props) => (
  <Link className="card device-card" to={`/devices/${device.id}`}>
    <div className="row-between">
      <strong>{device.serial_number}</strong>
      <StatusDot status={device.status} />
    </div>
    <div className="muted">{device.route}</div>
    <div className="muted">
      {device.screen_count} screens · {device.status}
    </div>
    <div className="muted">Heartbeat: {device.last_heartbeat}</div>
  </Link>
);

