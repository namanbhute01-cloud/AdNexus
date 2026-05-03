const { spawn } = require('child_process');
const path = require('path');

// Root directory for all apps
const ROOT = process.cwd();

const apps = [
  { name: 'API', cmd: 'npm', args: ['run', 'start:dev'], cwd: path.join(ROOT, 'apps/api') },
  { name: 'DASHBOARD', cmd: 'npm', args: ['start'], cwd: path.join(ROOT, 'apps/dashboard') }
];

console.log('--- Starting AdNexus Full Stack ---');

apps.forEach(app => {
  const child = spawn(app.cmd, app.args, {
    cwd: app.cwd,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (err) => {
    console.error(`Failed to start ${app.name}:`, err);
  });
});
