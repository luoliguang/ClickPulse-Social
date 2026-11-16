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
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
