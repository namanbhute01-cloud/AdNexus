type Props = {
  online: number;
  offline: number;
  alerts: number;
  uptime: number;
};

export const FleetSummary = ({ online, offline, alerts, uptime }: Props) => (
  <div className="grid grid-4">
    <div className="card"><strong>{online}</strong><div className="muted">Online</div></div>
    <div className="card"><strong>{offline}</strong><div className="muted">Offline</div></div>
    <div className="card"><strong>{alerts}</strong><div className="muted">Alerts</div></div>
    <div className="card"><strong>{uptime}%</strong><div className="muted">Uptime</div></div>
  </div>
);

