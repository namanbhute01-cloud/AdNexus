import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../lib/api';
import { mockCampaigns, mockDevices, mockSchedule } from '../data/mock';
import { ModeSelector } from '../components/schedule/ModeSelector';
import { SlotEditor } from '../components/schedule/SlotEditor';
import { ScheduleTimeline } from '../components/schedule/ScheduleTimeline';
import { PlayMode } from '../types';

export const SchedulesPage = () => {
  const [deviceId, setDeviceId] = useState(mockDevices[0].id);
  const [screen, setScreen] = useState<'A' | 'B' | 'C' | 'ALL'>('A');
  const [mode, setMode] = useState<PlayMode>('MIRROR');

  const campaignsQuery = useQuery({ queryKey: ['campaigns'], queryFn: dashboardApi.getCampaigns });
  const scheduleQuery = useQuery({
    queryKey: ['schedule', deviceId],
    queryFn: () => dashboardApi.getSchedule(deviceId),
  });

  const slots = useMemo(() => scheduleQuery.data ?? mockSchedule, [scheduleQuery.data]);

  return (
    <section className="stack">
      <div className="card row-gap">
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          {mockDevices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.serial_number}
            </option>
          ))}
        </select>
        <select value={screen} onChange={(e) => setScreen(e.target.value as typeof screen)}>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="ALL">All</option>
        </select>
        <input type="date" />
      </div>
      <ModeSelector mode={mode} onChange={setMode} />
      <SlotEditor campaigns={campaignsQuery.data ?? mockCampaigns} onCreate={() => undefined} />
      <ScheduleTimeline slots={slots} />
    </section>
  );
};

