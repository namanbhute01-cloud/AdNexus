import { AlertItem, Campaign, Device, FleetStats, ScheduleSlot, ScreenPreviewData, Telemetry } from '../types';

export const mockFleetStats: FleetStats = {
  online: 42,
  offline: 3,
  alerts: 1,
  uptimePercent: 99.2,
  todaysPlays: 18400,
};

export const mockDevices: Device[] = [
  {
    id: '22222222-2222-2222-2222-222222222221',
    serial_number: 'EV-0042',
    route: 'Bengaluru Route 7',
    status: 'ONLINE',
    last_heartbeat: '12s ago',
    screen_count: 3,
    cpu_temp_c: 34,
    disk_usage_percent: 42,
    location: { lat: 12.9716, lng: 77.5946 },
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    serial_number: 'EV-0019',
    route: 'MG Road Circular',
    status: 'OFFLINE',
    last_heartbeat: '4h ago',
    screen_count: 3,
    cpu_temp_c: 41,
    disk_usage_percent: 38,
    location: { lat: 12.9352, lng: 77.6245 },
  },
  {
    id: '22222222-2222-2222-2222-222222222223',
    serial_number: 'EV-0007',
    route: 'Airport Connector',
    status: 'ONLINE',
    last_heartbeat: '8s ago',
    screen_count: 3,
    cpu_temp_c: 39,
    disk_usage_percent: 36,
    location: { lat: 13.0358, lng: 77.597 },
  },
];

export const mockCampaigns: Campaign[] = [
  { id: 'c1', name: 'Coca-Cola Ad', duration_seconds: 30, resolution: '1920x1080' },
  { id: 'c2', name: 'Swiggy Promo', duration_seconds: 20, resolution: '1920x1080' },
  { id: 'c3', name: 'Nykaa Sale', duration_seconds: 25, resolution: '3840x2160' },
];

export const mockAlerts: AlertItem[] = [
  { id: 'a1', message: 'EV-0019 missed 3 heartbeats', createdAt: '2m ago' },
  { id: 'a2', message: 'EV-0042 thermal warning cleared', createdAt: '22m ago' },
];

export const mockScreens: ScreenPreviewData[] = [
  { id: 'sA', position: 'A', type: 'TV', resolution: '1920×1080', campaign_name: 'Coca-Cola Ad', mode: 'MIRROR', synced: true },
  { id: 'sB', position: 'B', type: 'LED', resolution: '1280×720', campaign_name: 'Swiggy Promo', mode: 'INDEPENDENT', synced: false },
  { id: 'sC', position: 'C', type: 'TV', resolution: '3840×2160', campaign_name: 'Nykaa Sale', mode: 'MIRROR', synced: true },
];

export const mockSchedule: ScheduleSlot[] = [
  { id: 'sl1', screen: 'A', campaignName: 'Swiggy Morning', start: '06:00', end: '09:00', mode: 'MIRROR' },
  { id: 'sl2', screen: 'A', campaignName: 'Nykaa Promo', start: '09:00', end: '12:00', mode: 'MIRROR' },
  { id: 'sl3', screen: 'A', campaignName: 'Coca-Cola', start: '12:00', end: '15:00', mode: 'MIRROR' },
];

export const mockTelemetry: Telemetry = {
  cpu: '34°C',
  ram: '6.1/16GB',
  disk: '42%',
  network: 'WiFi 12Mbps | 4G standby',
  lastUpdate: 'just now',
};

