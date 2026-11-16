const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const apiRoot = process.env.CLICKPULSE_API_ROOT || __dirname;
let revision = process.env.CLICKPULSE_REVISION || 'unknown';
try {
  const candidate = readFileSync(join(__dirname, 'REVISION'), 'utf8').trim();
  if (/^[0-9a-f]{40}$/.test(candidate)) revision = candidate;
} catch { /* Local and legacy layouts may not have a release marker. */ }

module.exports = {
  apps: [{
    name: 'clickpulse-api',
    script: './dist/index.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 10,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      UPDATE_ROOT: '/www/wwwroot/clickpulse-data/updates',
      DOTENV_CONFIG_PATH: `${apiRoot}/.env`,
      CLICKPULSE_REVISION: revision,
    },
    error_file: `${apiRoot}/logs/error.log`,
    out_file: `${apiRoot}/logs/out.log`,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
