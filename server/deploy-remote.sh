#!/usr/bin/env bash
set -Eeuo pipefail

for name in API_ROOT API_PORT NODE_BIN DEPLOY_RELEASE DEPLOY_REVISION; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing deployment variable: $name" >&2
    exit 1
  fi
done

[[ "$API_ROOT" =~ ^/www/wwwroot/[A-Za-z0-9._-]+-api$ ]] || { echo "Unsafe API_ROOT: $API_ROOT" >&2; exit 1; }
[[ "$API_PORT" =~ ^[0-9]+$ ]] && (( API_PORT >= 1 && API_PORT <= 65535 )) || { echo "API_PORT must be a valid TCP port" >&2; exit 1; }
[[ "$NODE_BIN" =~ ^(/www/server/nodejs|/root/\.nvm/versions/node)/v[0-9]+(\.[0-9]+){1,2}/bin$ ]] || { echo "Unsafe NODE_BIN: $NODE_BIN" >&2; exit 1; }
[[ "$DEPLOY_RELEASE" =~ ^[0-9a-f]{40}-[0-9]+$ ]] || { echo "Invalid release id" >&2; exit 1; }
[[ "$DEPLOY_REVISION" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid revision" >&2; exit 1; }

export PATH="$NODE_BIN:$PATH"
release_root="$API_ROOT/releases"
release_dir="$release_root/$DEPLOY_RELEASE"
current_link="$API_ROOT/current"

[[ -f "$API_ROOT/.env" ]] || { echo "$API_ROOT/.env is missing" >&2; exit 1; }
[[ -f "$release_dir/dist/index.js" ]] || { echo "Release server bundle is missing" >&2; exit 1; }
[[ -f "$release_dir/dist/migrate.js" ]] || { echo "Release migration bundle is missing" >&2; exit 1; }
[[ -f "$release_dir/schema.sql" ]] || { echo "Release schema is missing" >&2; exit 1; }
[[ -f "$release_dir/ecosystem.config.cjs" ]] || { echo "Release PM2 config is missing" >&2; exit 1; }
printf '%s\n' "$DEPLOY_REVISION" > "$release_dir/REVISION"
chmod 0444 "$release_dir/REVISION"
mkdir -p "$API_ROOT/logs"

previous_target=""
previous_config=""
if [[ -L "$current_link" ]]; then
  previous_target="$(readlink -f "$current_link")"
  previous_config="$previous_target/ecosystem.config.cjs"
elif [[ -f "$API_ROOT/ecosystem.config.cjs" && -f "$API_ROOT/dist/index.js" ]]; then
  previous_config="$API_ROOT/ecosystem.config.cjs"
fi

restart_api() {
  config_path="$1"
  pm2 delete clickpulse-api >/dev/null 2>&1 || true
  pm2 start "$config_path" --update-env
}

switched=0
rollback() {
  status=$?
  trap - ERR
  set +e
  if (( switched )); then
    echo "Deployment failed; restoring the previous ClickPulse API release" >&2
    if [[ -n "$previous_target" && -f "$previous_config" ]]; then
      ln -sfn "$previous_target" "$current_link.rollback"
      mv -Tf "$current_link.rollback" "$current_link"
      CLICKPULSE_API_ROOT="$API_ROOT" CLICKPULSE_REVISION="rollback" \
        restart_api "$previous_config"
    elif [[ -n "$previous_config" ]]; then
      rm -f -- "$current_link"
      CLICKPULSE_API_ROOT="$API_ROOT" CLICKPULSE_REVISION="rollback" \
        restart_api "$previous_config"
    else
      pm2 delete clickpulse-api >/dev/null 2>&1 || true
    fi
    for _ in $(seq 1 15); do
      curl --fail --silent --output /dev/null "http://127.0.0.1:$API_PORT/api/v1/health" && break
      sleep 1
    done
    pm2 logs clickpulse-api --lines 50 --nostream || true
  fi
  exit "$status"
}
trap rollback ERR

cd "$release_dir"
DOTENV_CONFIG_PATH="$API_ROOT/.env" node dist/migrate.js

ln -sfn "$release_dir" "$current_link.next"
mv -Tf "$current_link.next" "$current_link"
switched=1

export CLICKPULSE_API_ROOT="$API_ROOT"
export CLICKPULSE_REVISION="$DEPLOY_REVISION"
restart_api "$current_link/ecosystem.config.cjs"

healthy=0
response=""
for _ in $(seq 1 30); do
  if response="$(curl --fail --silent "http://127.0.0.1:$API_PORT/api/v1/health")" && \
    node -e 'const h=JSON.parse(process.argv[1]); if(h.ok!==true||h.revision!==process.argv[2]) process.exit(1)' "$response" "$DEPLOY_REVISION"; then
    healthy=1
    break
  fi
  sleep 1
done
if (( ! healthy )); then
  echo "Health check did not report revision $DEPLOY_REVISION; last response: ${response:-unavailable}" >&2
  pm2 logs clickpulse-api --lines 50 --nostream || true
  false
fi

pm2 save --force >/dev/null
switched=0
trap - ERR

mapfile -t stale_releases < <(ls -1dt "$release_root"/*/ 2>/dev/null | tail -n +6 || true)
for stale in "${stale_releases[@]}"; do
  case "$stale" in
    "$release_root"/*/) rm -rf -- "$stale" ;;
  esac
done

echo "Deployed ClickPulse API revision $DEPLOY_REVISION"
