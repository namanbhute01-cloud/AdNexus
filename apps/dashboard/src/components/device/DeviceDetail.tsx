import { useMutation, useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../lib/api';
import { PlayMode } from '../../types';
import { ScreenPreview } from './ScreenPreview';
import { TelemetryBar } from './TelemetryBar';
import { CommandButton } from '../common/CommandButton';
import { useLiveFeed } from '../../hooks/useLiveFeed';

type Props = { deviceId: string };

export const DeviceDetail = ({ deviceId }: Props) => {
  const deviceQuery = useQuery({ queryKey: ['device', deviceId], queryFn: () => dashboardApi.getDevice(deviceId) });
  const screensQuery = useQuery({ queryKey: ['screens', deviceId], queryFn: () => dashboardApi.getDeviceScreens(deviceId) });
  const { telemetry } = useLiveFeed();

  const restartMutation = useMutation({ mutationFn: () => dashboardApi.sendCommand(deviceId, 'restart') });
  const skipMutation = useMutation({ mutationFn: () => dashboardApi.sendCommand(deviceId, 'skip') });

  const device = deviceQuery.data;
  const screens = screensQuery.data ?? [];

  return (
    <section className="stack">
      <div className="card">
        <h2>
          {device?.serial_number ?? 'EV'} · {device?.route ?? 'Route'} · {device?.status ?? 'ONLINE'}
        </h2>
        <div className="muted">Last heartbeat: {device?.last_heartbeat ?? '-'}</div>
      </div>

      <div className="grid grid-3">
        {screens.map((screen) => (
          <ScreenPreview key={screen.id} screen={screen} />
        ))}
      </div>

      <div className="card controls">
        <div className="muted">Controls</div>
        <div className="row-gap">
          <CommandButton label="Restart Device" onConfirm={() => restartMutation.mutate()} />
          <CommandButton label="Skip Ad" onConfirm={() => skipMutation.mutate()} />
          <input type="range" min={0} max={100} defaultValue={70} />
        </div>
        <div className="mode-buttons">
          {(['MIRROR', 'INDEPENDENT', 'COMBINED'] as PlayMode[]).map((mode) => (
            <button key={mode} className="btn">
              {mode}
            </button>
          ))}
        </div>
      </div>

      <TelemetryBar telemetry={telemetry} />
    </section>
  );
};

