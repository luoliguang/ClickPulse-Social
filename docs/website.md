# ClickPulse official website

The official website is a dependency-free static site under `website/`. It is served at `https://clickpulse.fangdutex.cn/` while the leaderboard, update metadata, downloads and administration routes continue to use the Fastify service on `127.0.0.1:3032`.

## Release-driven downloads

The browser requests `/api/v1/updates/latest` at runtime. A published stable Release updates that metadata through the existing release/mirror workflow, so the website does not need a new deployment when only the app version changes. The metadata supplies the exact version, release notes, file sizes, checksums and domestic download URLs for:

- Windows x64 portable ZIP
- macOS Apple Silicon DMG
- macOS Intel x64 DMG
- Linux x64 ZIP
- Linux ARM64 ZIP

The desktop updater still selects only its exact ZIP and manifest. Additional DMG entries are for website downloads and do not change updater selection. If metadata is unavailable, the page keeps the platform choices visible and sends visitors to the latest GitHub Release instead of presenting an unverified version as current.

## Local preview and validation

```bash
revision=$(git rev-parse HEAD)
python scripts/build_website.py --revision "$revision"
node --check dist/website/app.js
python3 -m http.server 8768 --bind 127.0.0.1 --directory dist/website
```

Open `http://127.0.0.1:8768/`. The local preview cannot load the production same-origin metadata unless it is proxied; this intentionally exercises the GitHub fallback state.

## GitHub configuration

The `Deploy official website` workflow reuses `SSH_HOST`, `SSH_USER`, `SSH_KEY` and optional `SSH_PORT`. Add this repository variable:

```text
WEB_ROOT=/www/wwwroot/clickpulse.fangdutex.cn
```

The workflow accepts only that exact web root. It performs an rsync dry run, then synchronizes the built site while excluding `.user.ini`, `.well-known/` and `.htaccess`. Its final check requires both the deployed Git revision in the HTML and a working API health response through the public domain.

## BaoTa / Nginx routing

Create or update the BaoTa site for `clickpulse.fangdutex.cn` so its document root is `/www/wwwroot/clickpulse.fangdutex.cn`. Keep the existing TLS certificate. Replace an all-path API reverse proxy with explicit API and admin locations, then serve the website for every other path.

Merge the following locations into the existing HTTPS `server` block; do not create a second competing `server_name` block:

```nginx
root /www/wwwroot/clickpulse.fangdutex.cn;
index index.html;

location ^~ /api/ {
    proxy_pass http://127.0.0.1:3032;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /admin {
    proxy_pass http://127.0.0.1:3032;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location ^~ /admin/ {
    proxy_pass http://127.0.0.1:3032;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location ~* \.(?:css|js|png|jpg|jpeg|webp|svg|ico|webmanifest)$ {
    try_files $uri =404;
    expires 7d;
    add_header Cache-Control "public";
}

location / {
    try_files $uri $uri/ =404;
}

error_page 404 /404.html;
location = /404.html {
    internal;
}
```

Do not proxy `/` to port 3032 after the website is enabled. Do not remove BaoTa's certificate, ACME or protection directives around these locations.

## First rollout order

1. Push and verify the API deployment, including the health revision.
2. Set `WEB_ROOT` in GitHub repository variables.
3. Upload the static site once or run the website workflow manually.
4. Change the BaoTa Nginx locations and reload Nginx.
5. Run the website workflow again so its public website/API verification succeeds.
6. Verify `/`, `/api/v1/health`, `/api/v1/updates/latest`, `/admin`, each platform download, mobile layout and both languages.

After the first rollout, website source changes deploy on pushes to `main`; app versions and download links update when a stable Release is published.
