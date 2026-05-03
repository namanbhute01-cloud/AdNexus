CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_status') THEN
    CREATE TYPE device_status AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'screen_position') THEN
    CREATE TYPE screen_position AS ENUM ('A', 'B', 'C');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_screen_position') THEN
    CREATE TYPE schedule_screen_position AS ENUM ('A', 'B', 'C', 'ALL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'play_mode') THEN
    CREATE TYPE play_mode AS ENUM ('MIRROR', 'INDEPENDENT', 'COMBINED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY,
  serial_number VARCHAR(64) UNIQUE NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status device_status NOT NULL DEFAULT 'OFFLINE',
  last_heartbeat TIMESTAMPTZ,
  location JSONB,
  firmware_version VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_checksum VARCHAR(255) NOT NULL,
  duration_seconds INT NOT NULL,
  resolution VARCHAR(32),
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screens (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  sub_serial VARCHAR(64) UNIQUE NOT NULL,
  position screen_position NOT NULL,
  display_info JSONB,
  current_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_device_screen_position UNIQUE (device_id, position)
);

CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  screen_position schedule_screen_position NOT NULL,
  play_mode play_mode NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  repeat_interval INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_schedule_time_range CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS proof_of_play (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL,
  duration_played_seconds INT NOT NULL,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_organization_id ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedules_device_start_time ON schedules(device_id, start_time);
CREATE INDEX IF NOT EXISTS idx_proof_of_play_device_played_at ON proof_of_play(device_id, played_at);

INSERT INTO organizations (id, name)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'AdNexus Test Org')
ON CONFLICT (id) DO NOTHING;

INSERT INTO devices (id, serial_number, organization_id, status, location, firmware_version)
VALUES
  (
    '22222222-2222-2222-2222-222222222221',
    'EV-0042',
    '11111111-1111-1111-1111-111111111111',
    'ONLINE',
    '{"lat":12.9716,"lng":77.5946,"city":"Bengaluru"}',
    '0.1.0'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'EV-0019',
    '11111111-1111-1111-1111-111111111111',
    'OFFLINE',
    '{"lat":12.9352,"lng":77.6245,"city":"Bengaluru"}',
    '0.1.0'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO screens (id, device_id, sub_serial, position, display_info)
VALUES
  (
    '33333333-3333-3333-3333-333333333421',
    '22222222-2222-2222-2222-222222222221',
    'EV-0042-A',
    'A',
    '{"type":"TV","resolution":"1920x1080","refresh_rate":60,"aspect_ratio":"16:9"}'
  ),
  (
    '33333333-3333-3333-3333-333333333422',
    '22222222-2222-2222-2222-222222222221',
    'EV-0042-B',
    'B',
    '{"type":"LED","resolution":"1280x720","refresh_rate":60,"aspect_ratio":"16:9"}'
  ),
  (
    '33333333-3333-3333-3333-333333333423',
    '22222222-2222-2222-2222-222222222221',
    'EV-0042-C',
    'C',
    '{"type":"TV","resolution":"3840x2160","refresh_rate":60,"aspect_ratio":"16:9"}'
  ),
  (
    '33333333-3333-3333-3333-333333333191',
    '22222222-2222-2222-2222-222222222222',
    'EV-0019-A',
    'A',
    '{"type":"TV","resolution":"1920x1080","refresh_rate":60,"aspect_ratio":"16:9"}'
  ),
  (
    '33333333-3333-3333-3333-333333333192',
    '22222222-2222-2222-2222-222222222222',
    'EV-0019-B',
    'B',
    '{"type":"TV","resolution":"1920x1080","refresh_rate":60,"aspect_ratio":"16:9"}'
  ),
  (
    '33333333-3333-3333-3333-333333333193',
    '22222222-2222-2222-2222-222222222222',
    'EV-0019-C',
    'C',
    '{"type":"Projector","resolution":"1920x1080","refresh_rate":60,"aspect_ratio":"16:9"}'
  )
ON CONFLICT (id) DO NOTHING;

CREATE TYPE user_role AS ENUM ('ADMIN', 'CAMPAIGNER', 'SCREEN');

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'CAMPAIGNER',
  screen_id     UUID REFERENCES screens(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_sched_device   ON schedules(device_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_pop_device     ON proof_of_play(device_id, played_at);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
