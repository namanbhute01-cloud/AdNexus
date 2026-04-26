import axios from 'axios';
import { mockCampaigns, mockDevices, mockFleetStats, mockScreens, mockSchedule } from '../data/mock';
import { Campaign, Device, FleetStats, ScreenPreviewData, ScheduleSlot } from '../types';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1',
  timeout: 10000,
});

const fallback = async <T>(fn: () => Promise<T>, value: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return value;
  }
};

export const dashboardApi = {
  async getFleetStats(): Promise<FleetStats> {
    return fallback(async () => (await api.get('/dashboard/fleet-stats')).data, mockFleetStats);
  },
  async getDevices(): Promise<Device[]> {
    return fallback(async () => (await api.get('/devices')).data, mockDevices);
  },
  async getDevice(deviceId: string): Promise<Device> {
    return fallback(async () => (await api.get(`/devices/${deviceId}`)).data, mockDevices[0]);
  },
  async getDeviceScreens(deviceId: string): Promise<ScreenPreviewData[]> {
    return fallback(async () => (await api.get(`/devices/${deviceId}/screens`)).data, mockScreens);
  },
  async getCampaigns(): Promise<Campaign[]> {
    return fallback(async () => (await api.get('/campaigns')).data, mockCampaigns);
  },
  async uploadCampaign(formData: FormData): Promise<Campaign> {
    return (await api.post('/campaigns', formData)).data;
  },
  async getSchedule(deviceId: string): Promise<ScheduleSlot[]> {
    return fallback(async () => (await api.get(`/devices/${deviceId}/schedule`)).data, mockSchedule);
  },
  async sendCommand(deviceId: string, command: 'restart' | 'skip') {
    const endpoint = command === 'restart' ? `/commands/device/${deviceId}/restart` : `/commands/device/${deviceId}/skip`;
    return api.post(endpoint);
  },
  async emergencyOverride(campaignId: string, deviceIds: string[], durationMinutes?: number) {
    return api.post('/commands/emergency-override', { campaignId, deviceIds, durationMinutes });
  },
};

