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
- Shared logs: `/www/wwwroot/clickpulse-api/logs`
- Immutable releases: `/www/wwwroot/clickpulse-api/releases/<revision>-<attempt>`
- Active release: `/www/wwwroot/clickpulse-api/current`
- Private avatar root: `/www/wwwroot/clickpulse-data/avatars`
- Private update mirror root: `/www/wwwroot/clickpulse-data/updates`
- Local listen address: `127.0.0.1:3032`
- Public reverse proxy: `https://clickpulse.fangdutex.cn/` → `http://127.0.0.1:3032/`

Avatar and update directories must not be placed in a public web root. Files are served only through validated API routes.

Create an independent PostgreSQL database and user, copy `.env.example` to `.env`, then run:

```bash
npm run build
npm run migrate
pm2 startOrReload ecosystem.config.cjs
curl http://127.0.0.1:3032/api/v1/health
```

Production pushes use `.github/workflows/deploy-api.yml`. Each run uploads a new immutable release, runs the database migration against that release, atomically switches `current`, reloads PM2, and verifies both the database-backed local health endpoint and the public reverse proxy expose the expected Git revision. A failed migration leaves the running release untouched; a failed reload or local health check restores the previous release. The five newest releases are retained. Database migrations must remain backward compatible because application rollback does not reverse a completed schema migration.

## Invitation administration

Generate the administrator password hash once, add the printed value to `.env` as `ADMIN_PASSWORD_HASH`, and reload the process:

```bash
read -rsp 'New ClickPulse admin password: ' CLICKPULSE_ADMIN_PASSWORD; echo
export CLICKPULSE_ADMIN_PASSWORD
node dist/admin-password.js
unset CLICKPULSE_ADMIN_PASSWORD
```

Copy the printed hash (not the plaintext password) into `.env`, run `pm2 startOrReload ecosystem.config.cjs`, then open `https://clickpulse.fangdutex.cn/admin` on a phone or computer. The page creates readable grouped codes with expiring active-member capacity, shows each plaintext code only in the creation response, lists occupied and remaining slots, and can revoke unused capacity. A member occupies one slot while joined and releases it on leaving. The password is verified with scrypt; the browser receives an eight-hour `HttpOnly`, `Secure`, `SameSite=Strict` session cookie. Mutating requests also require the production same-origin header.

The CLI remains available as an emergency fallback:

```bash
npm run invite -- 1 30
```

Invitation plaintext is never stored; the database contains only SHA-256 hashes. Back up PostgreSQL and the avatar directory together. Deployments preserve `.env`, `logs/`, avatars, and mirrored update packages. The release workflow publishes verified ZIPs, manifests and checksums to the private update root after creating each GitHub Release.
