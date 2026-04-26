type Props = { status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' };

export const StatusDot = ({ status }: Props) => {
  return <span className={`status-dot ${status.toLowerCase()}`} aria-label={status} />;
};

