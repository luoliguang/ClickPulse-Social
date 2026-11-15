# ClickPulse leaderboard API

This service receives only opt-in daily keyboard and mouse totals. It never accepts key identities, typed content, application names, pointer positions, or minute-level events.

## Local verification

```bash
npm ci
npm test
npm run typecheck
npm run build
```

## Production layout

- API root: `/www/wwwroot/clickpulse-api`
- Private environment: `/www/wwwroot/clickpulse-api/.env`
- Private avatar root: `/www/wwwroot/clickpulse-data/avatars`
- Local listen address: `127.0.0.1:3002`
- Public reverse proxy: `https://clickpulse.fangdutex.cn/api/` → `http://127.0.0.1:3002/api/`

The avatar directory must not be placed in a public web root. Images are served through the validated API route.

Create an independent PostgreSQL database and user, copy `.env.example` to `.env`, then run:

```bash
npm run build
npm run migrate
pm2 startOrReload ecosystem.config.cjs
curl http://127.0.0.1:3002/api/v1/health
```

Create an invitation code with a maximum use count and validity in days:

```bash
npm run invite -- 1 30
```

The command prints the only plaintext copy of the code; the database stores only its SHA-256 hash. Back up PostgreSQL and the avatar directory together. Deployments must preserve `.env`, `logs/`, and the avatar directory.
