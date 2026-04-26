import { Telemetry } from '../../types';

type Props = { telemetry: Telemetry };

export const TelemetryBar = ({ telemetry }: Props) => (
  <div className="card telemetry">
    <div className="muted">Telemetry (live via WebSocket)</div>
    <div>CPU: {telemetry.cpu}</div>
    <div>RAM: {telemetry.ram}</div>
    <div>Disk: {telemetry.disk}</div>
    <div>Network: {telemetry.network}</div>
    <div className="muted">Updated: {telemetry.lastUpdate}</div>
  </div>
);

