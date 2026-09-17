#!/usr/bin/env bash
#
# Kisan Mitra — setup script
#
#   ./install.sh            install dependencies and create backend/.env
#   ./install.sh --start    install (if needed), then start both servers
#   ./install.sh --check    verify an existing setup, install nothing
#
# Works on Linux, macOS and Windows (Git Bash / WSL). Needs only bash and Node.

set -eu

# ---------------------------------------------------------------- pretty output
if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RED=$(printf '\033[31m')
  GREEN=$(printf '\033[32m'); YELLOW=$(printf '\033[33m'); OFF=$(printf '\033[0m')
else
  BOLD=''; DIM=''; RED=''; GREEN=''; YELLOW=''; OFF=''
fi
ok()   { printf '%s✓%s %s\n' "$GREEN" "$OFF" "$1"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$OFF" "$1"; }
bad()  { printf '%s✗%s %s\n' "$RED" "$OFF" "$1"; }
step() { printf '\n%s%s%s\n' "$BOLD" "$1" "$OFF"; }

MODE='install'
for arg in "$@"; do
  case "$arg" in
    --start) MODE='start' ;;
    --check) MODE='check' ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) bad "Unknown option: $arg (try --help)"; exit 2 ;;
  esac
done

# Resolve the project root from the script location, so it can be run from anywhere
ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT"
printf '%sKisan Mitra setup%s  %s(%s)%s\n' "$BOLD" "$OFF" "$DIM" "$ROOT" "$OFF"

# ------------------------------------------------------------- 1. Node version
step '1/5 Checking Node.js'
if ! command -v node >/dev/null 2>&1; then
  bad 'Node.js is not installed.'
  printf '    Install Node.js 22 or newer, then run this script again:\n'
  printf '      https://nodejs.org/en/download\n'
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  bad 'npm is not available on PATH (it ships with Node.js).'
  exit 1
fi

NODE_VERSION=$(node -p 'process.versions.node')
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
NODE_MINOR=$(node -p 'process.versions.node.split(".")[1]')

if [ "$NODE_MAJOR" -lt 20 ] || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 19 ]; }; then
  bad "Node.js $NODE_VERSION is too old — 20.19+ is required, 22+ recommended."
  printf '    (Vite 8 needs >=20.19; firebase-admin needs >=22 for cloud history.)\n'
  exit 1
elif [ "$NODE_MAJOR" -lt 22 ]; then
  warn "Node.js $NODE_VERSION works, but 22+ is recommended (firebase-admin 14 requires it)."
else
  ok "Node.js $NODE_VERSION  ·  npm $(npm --version)"
fi

# -------------------------------------------------------- 2. backend/.env file
step '2/5 Preparing backend/.env'
ENV_FILE='backend/.env'
ENV_TEMPLATE='backend/.env.example'

if [ ! -f "$ENV_TEMPLATE" ]; then
  bad "$ENV_TEMPLATE is missing — cannot create the environment file."
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  ok "$ENV_FILE already exists — left untouched"
else
  cp "$ENV_TEMPLATE" "$ENV_FILE"
  ok "Created $ENV_FILE from the template"
fi

# Report which keys are missing or still hold template placeholders (never the
# values). This delegates to backend/services/serviceStatus.js — the same module
# the boot log and /api/health use — because a private grep here silently missed
# FIREBASE_PROJECT_ID and called a half-configured install ready.
missing_core_keys=''
missing_optional_keys=''
secret_state='set'

env_report=$(node -e '
const fs = require("fs");
const path = require("path");
const file = process.argv[1];

// Parse .env the way dotenv does: a real environment variable wins, quotes stripped.
for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (!m) continue;
  const value = m[2].trim().replace(/^["\x27]|["\x27]$/g, "");
  if (process.env[m[1]] === undefined) process.env[m[1]] = value;
}

const { describeValue } = require(path.join(process.cwd(), "backend", "services", "serviceStatus.js"));
const keys = ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENWEATHER_API_KEY", "FIREBASE_PROJECT_ID", "PROFILE_AUTH_SECRET"];
for (const key of keys) {
  const state = describeValue(process.env[key]);
  if (state !== "set") console.log(key + " " + state);
}
' "$ENV_FILE" 2>/dev/null || true)

while read -r key state; do
  [ -n "$key" ] || continue
  case "$key" in
    GROQ_API_KEY|GEMINI_API_KEY|OPENWEATHER_API_KEY) missing_core_keys="$missing_core_keys $key" ;;
    FIREBASE_PROJECT_ID) missing_optional_keys="$missing_optional_keys $key" ;;
    PROFILE_AUTH_SECRET) secret_state="$state" ;;
  esac
done <<< "$env_report"

if [ -n "$missing_core_keys" ]; then
  warn "Missing or placeholder keys in $ENV_FILE:$missing_core_keys"
  printf '    The app starts without them; AI diagnosis, chat and voice stay off\n'
  printf '    until you paste real keys (free tiers: console.groq.com,\n'
  printf '    aistudio.google.com/apikey, openweathermap.org/api).\n'
fi

if [ -n "$missing_optional_keys" ]; then
  warn "Optional keys not configured:$missing_optional_keys"
  printf '    Cloud history is off; scans are saved to backend/data/scans.json instead.\n'
fi

if [ -z "$missing_core_keys" ] && [ -z "$missing_optional_keys" ]; then
  ok 'API keys look configured'
fi

if [ "$secret_state" != 'set' ]; then
  warn "PROFILE_AUTH_SECRET is $secret_state — sessions use a locally derived key."
  printf '    Fine locally (sign-ins survive restarts); set a long random value\n'
  printf '    before deploying anywhere public.\n'
fi

if [ "$MODE" = 'check' ]; then
  step '3/5 Checking installed dependencies (nothing installed in --check mode)'
  for pkg in backend frontend; do
    if [ -d "$pkg/node_modules" ]; then ok "$pkg/node_modules present"
    else bad "$pkg/node_modules missing — run ./install.sh"; fi
  done
fi

# --------------------------------------------------------------- 3. installing
if [ "$MODE" != 'check' ]; then
  step '3/5 Installing dependencies'

  install_package() {
    name="$1"; dir="$2"
    printf '  %s…\n' "$name"
    if [ -f "$dir/package-lock.json" ]; then
      # npm ci is reproducible but refuses to run if the lockfile drifted;
      # fall back to a regular install rather than failing the whole script.
      if (cd "$dir" && npm ci --no-audit --no-fund); then
        ok "$name dependencies installed (npm ci)"
      elif (cd "$dir" && npm install --no-audit --no-fund); then
        warn "$name lockfile was out of date — installed with npm install"
      else
        bad "$name install failed. See the output above."
        exit 1
      fi
    elif (cd "$dir" && npm install --no-audit --no-fund); then
      ok "$name dependencies installed (npm install)"
    else
      bad "$name install failed. See the output above."
      exit 1
    fi
  }

  install_package 'backend'  'backend'
  install_package 'frontend' 'frontend'
fi

# ------------------------------------------------------------- 4. smoke checks
step '4/5 Verifying the install'
if (cd backend && npm test >/dev/null 2>&1); then
  ok 'backend tests pass (npm test)'
else
  warn 'backend tests did not pass — run: cd backend && npm test'
fi

if (cd frontend && npx --no-install oxlint >/dev/null 2>&1); then
  ok 'frontend lint is clean'
else
  warn 'frontend lint reported issues — run: cd frontend && npm run lint'
fi

if [ "$MODE" = 'check' ]; then
  printf '\n%sChecked.%s Start the app with:  ./install.sh --start\n' "$BOLD" "$OFF"
  exit 0
fi

# ------------------------------------------------------------------ 5. run it
if [ "$MODE" != 'start' ]; then
  step '5/5 Next steps'
  ok 'Setup complete'
  printf '\n  Start both servers:  %s./install.sh --start%s\n' "$BOLD" "$OFF"
  printf '  Or run them manually, in two terminals:\n'
  printf '    cd backend  && npm run dev     %s→ http://localhost:5000%s\n' "$DIM" "$OFF"
  printf '    cd frontend && npm run dev     %s→ http://localhost:5173%s\n\n' "$DIM" "$OFF"
  exit 0
fi

step '5/5 Starting the servers'

PORT_NOTE=''
# The backend validates PORT itself; just avoid passing a junk value through.
if [ -n "${PORT:-}" ] && ! printf '%s' "$PORT" | grep -Eq '^[0-9]+$'; then
  warn "Ignoring non-numeric PORT=\"$PORT\" from your shell (backend will use 5000)."
  unset PORT
fi

LOGS="$ROOT/.logs"
mkdir -p "$LOGS"

BACKEND_PID=''
FRONTEND_PID=''
cleanup() {
  printf '\n%sShutting down…%s\n' "$DIM" "$OFF"
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM

# Start each server in the background, logging to .logs/ (gitignored)
( cd backend && npm start ) > "$LOGS/backend.log" 2>&1 &
BACKEND_PID=$!
( cd frontend && npm run dev -- --host 127.0.0.1 ) > "$LOGS/frontend.log" 2>&1 &
FRONTEND_PID=$!

# Readiness probe via Node (no curl/wget dependency)
wait_for() {
  url="$1"; label="$2"; tries=0
  while [ "$tries" -lt 40 ]; do
    if node -e "fetch('$url').then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      ok "$label is up"
      return 0
    fi
    # if the process died, stop waiting and show the log
    if [ "$label" = 'backend' ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then break; fi
    if [ "$label" = 'frontend' ] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then break; fi
    tries=$((tries + 1))
    sleep 0.5
  done
  bad "$label did not respond in time — last lines of .logs/$label.log:"
  tail -n 15 "$LOGS/$label.log" 2>/dev/null || true
  cleanup
  exit 1
}

wait_for 'http://127.0.0.1:5000/api/ping' 'backend'
wait_for 'http://127.0.0.1:5173/' 'frontend'

printf '\n%sKisan Mitra is running%s\n' "$BOLD" "$OFF"
printf '  App       %shttp://127.0.0.1:5173%s\n' "$BOLD" "$OFF"
printf '  API       http://127.0.0.1:5000/api/health\n'
printf '  Logs      %s\n' "$LOGS"
printf '  Press %sCtrl+C%s to stop both servers.\n\n' "$BOLD" "$OFF"

wait
