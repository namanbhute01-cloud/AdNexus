# AdNexus Smart Content Manager

AdNexus is a vehicular digital signage platform designed for high-availability edge playback and centralized management.

## Project Structure
- `apps/api`: NestJS backend (Node.js 20)
- `apps/dashboard`: React 18 dashboard UI
- `apps/edge-agent`: Python 3.11 device management agent
- `apps/edge-player`: Python 3.11 playback controller (MPV integration)
- `infrastructure`: Docker compose configurations

## Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose

## Local Development Setup

### 1. Start Infrastructure
Navigate to the infrastructure directory and start the services:
```bash
cd AdNexus/infrastructure
sudo docker-compose up postgres redis mqtt
```

### 2. Configure Environment
Copy the example environment files in `apps/api` and `apps/dashboard`:
```bash
cp AdNexus/apps/api/.env.example AdNexus/apps/api/.env
```
*(Update `.env` with your desired secrets if needed)*

### 3. Run Backend API
```bash
cd AdNexus/apps/api
npm install
npm run start:dev
```

### 4. Run Frontend Dashboard
```bash
cd AdNexus/apps/dashboard
npm install
npm start
```

## Health Checks
The system is configured with health checks for Postgres and Redis. The API will wait for these services to be healthy before attempting to connect.

## UI Design System
The dashboard uses an "industrial mission-control" aesthetic with:
- Deep black themes (`#080A0F`)
- Cyan accent markers (`#00E5FF`)
- Monospaced data displays for telemetry
- Scan-line visual textures
