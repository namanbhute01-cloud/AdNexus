export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
export type PlayMode = 'MIRROR' | 'INDEPENDENT' | 'COMBINED';
export type ScreenPosition = 'A' | 'B' | 'C';

export type Device = {
  id: string;
  serial_number: string;
  route: string;
  status: DeviceStatus;
  last_heartbeat: string;
  screen_count: number;
  cpu_temp_c?: number;
  disk_usage_percent?: number;
  location?: { lat: number; lng: number };
};

export type ScreenPreviewData = {
  id: string;
  position: ScreenPosition;
  type: string;
  resolution: string;
  campaign_name: string;
  mode: PlayMode;
  synced: boolean;
};

export type Campaign = {
  id: string;
  name: string;
  duration_seconds: number;
  resolution?: string;
  thumbnail_url?: string;
};

export type FleetStats = {
  online: number;
  offline: number;
  alerts: number;
  uptimePercent: number;
  todaysPlays: number;
};

export type AlertItem = {
  id: string;
  message: string;
  createdAt: string;
};

export type ScheduleSlot = {
  id: string;
  screen: ScreenPosition | 'ALL';
  campaignName: string;
  start: string;
  end: string;
  mode: PlayMode;
};

export type Telemetry = {
  cpu: string;
  ram: string;
  disk: string;
  network: string;
  lastUpdate: string;
};

