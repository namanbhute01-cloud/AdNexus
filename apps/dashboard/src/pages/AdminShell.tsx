import React, { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { createAdNexusSocket } from '../lib/socket';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { DevicesPage } from './DevicesPage';
import { CampaignsPage } from './CampaignsPage';
import { SchedulesPage } from './SchedulesPage';
import { AnalyticsPage } from './AnalyticsPage';
import { ScreensPage } from './admin/Screens';
import { SettingsPage } from './SettingsPage';
import { AppShell } from '../components/layout/AppShell';

type Role = 'admin' | 'campaigner' | 'screen';

interface Session {
  token: string;
  role: Role;
  user: {
    id: string;
    username: string;
    role: Role;
  };
}

interface AdminShellProps {
  session: Session;
  onLogout: () => void;
}

export function AdminShell({ session, onLogout }: AdminShellProps) {
  return (
    <AppShell onLogout={onLogout} user={session.user}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="schedule" element={<SchedulesPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="screens" element={<ScreensPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>
    </AppShell>
  );
}
