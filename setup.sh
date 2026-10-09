#!/usr/bin/env bash
#
# AdNexus / Vaart-E CMS - complete one-shot setup for Linux and macOS.
#
# Installs every prerequisite (Node.js, pnpm, PostgreSQL), installs workspace
# dependencies, writes the .env files with a freshly generated AUTH_SECRET,
# creates the database, applies migrations and seeds the default users.
#
# Every step is idempotent, so it is safe to re-run after pulling new code.
#
#   ./setup.sh              # set everything up
#   ./setup.sh --start      # set up, then launch the dev server
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
DB_DIR="$ROOT_DIR/packages/database"
WEB_ENV_FILE="$WEB_DIR/.env.local"
DB_ENV_FILE="$DB_DIR/.env"

START_APP=0
[ "${1:-}" = "--start" ] && START_APP=1

# --------------------------------------------------------------------------
# Output helpers
# --------------------------------------------------------------------------
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_CYAN=$'\033[36m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_DIM=$'\033[2m'
else
  C_RESET=""; C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_DIM=""
fi

step() { printf '\n%s==> %s%s\n' "$C_CYAN" "$1" "$C_RESET"; }
ok()   { printf '    %s[ok]%s %s\n' "$C_GREEN" "$C_RESET" "$1"; }
info() { printf '    %s%s%s\n' "$C_DIM" "$1" "$C_RESET"; }
warn() { printf '    %s[warn]%s %s\n' "$C_YELLOW" "$C_RESET" "$1"; }
die()  { printf '\n%s[FAILED]%s %s\n' "$C_RED" "$C_RESET" "$1"; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"
  elif have sudo; then sudo "$@"
  else die "'$1' needs root and sudo is not installed."
  fi
}

# --------------------------------------------------------------------------
# Environment detection
# --------------------------------------------------------------------------
detect_os() {
  if [ "$(uname -s)" = "Darwin" ]; then echo "macos"
  elif [ -r /etc/os-release ] && . /etc/os-release && [ "${ID:-}" = "ubuntu" ]; then echo "ubuntu"
  elif [ "$(uname -s)" = "Linux" ]; then echo "debian"
  else echo "unknown"; fi
}
OS="$(detect_os)"

# --------------------------------------------------------------------------
# 1. Node.js  (>= 20.9.0 required by Next.js 16)
# --------------------------------------------------------------------------
install_node() {
  step "Checking Node.js (need >= 20.9.0)"

  if have node; then
    local major
    major="$(node --version | sed -E 's/^v//' | cut -d. -f1)"
    if [ "$major" -ge 20 ]; then ok "Node.js $(node --version)"; return; fi
    warn "Node.js $(node --version) is too old (need >= 20)."
  else
    warn "Node.js not found."
  fi

  info "Installing Node.js 22 LTS..."
  case "$OS" in
    macos)
      have brew || die "Homebrew is required to install Node.js. See https://brew.sh"
      brew install node@22
      # Homebrew keg-only, so it is not on PATH until linked.
      brew --prefix node@22 2>/dev/null | grep -q . && brew link --overwrite --force node@22 || true
      ;;
    ubuntu|debian)
      if have curl; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | as_root bash -
        as_root apt-get install -y nodejs
      else
        as_root apt-get update && as_root apt-get install -y nodejs
      fi
      ;;
    *)
      die "Cannot auto-install Node.js on this OS. Install Node 20+ from https://nodejs.org and re-run."
      ;;
  esac

  have node || die "Node.js installation did not complete. Install Node 20+ and re-run."
  ok "Node.js $(node --version) installed"
}
install_node

# --------------------------------------------------------------------------
# 2. pnpm
# --------------------------------------------------------------------------
install_pnpm() {
  step "Checking pnpm"

  if have corepack; then corepack enable >/dev/null 2>&1 || true; fi
  if have pnpm; then ok "pnpm $(pnpm --version)"; return; fi

  warn "Installing pnpm via npm..."
  have npm || die "npm is required to install pnpm."
  npm install -g pnpm@9 >/dev/null 2>&1 || true
  have pnpm || die "pnpm could not be installed. Try: npm install -g pnpm"
  ok "pnpm $(pnpm --version) installed"
}
install_pnpm

# --------------------------------------------------------------------------
# 3. PostgreSQL
# --------------------------------------------------------------------------
start_postgres() {
  if have systemctl; then as_root systemctl start postgresql >/dev/null 2>&1 || true
  elif have service; then as_root service postgresql start >/dev/null 2>&1 || true
  elif have brew && have pg_ctl; then
    local pgdir; pgdir="$(brew --prefix 2>/dev/null)/var/postgres"
    [ -d "$pgdir" ] && pg_ctl -D "$pgdir" start >/dev/null 2>&1 || true
  fi
}

wait_for_postgres() {
  local i
  for i in $(seq 1 30); do
    pg_isready -q 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

install_postgres() {
  step "Checking PostgreSQL"

  if have psql && pg_isready -q 2>/dev/null; then
    ok "PostgreSQL $(psql --version | awk '{print $3}') already running"
    return
  fi

  if have psql && [ "$OS" = "macos" ]; then
    warn "PostgreSQL installed but not running. Starting it..."
    brew services start postgresql@16 >/dev/null 2>&1 || start_postgres
    wait_for_postgres && { ok "PostgreSQL started"; return; }
  fi

  if ! have psql; then
    warn "PostgreSQL not found. Installing..."
    case "$OS" in
      macos)
        have brew || die "Homebrew is required. See https://brew.sh"
        brew install postgresql@16
        brew services start postgresql@16 >/dev/null 2>&1 || start_postgres
        ;;
      ubuntu|debian)
        as_root apt-get update -qq
        as_root apt-get install -y postgresql postgresql-contrib
        start_postgres
        ;;
      *)
        die "Cannot auto-install PostgreSQL here. Install PostgreSQL 14+ and re-run."
        ;;
    esac
  else
    start_postgres
  fi

  wait_for_postgres || die "PostgreSQL is installed but not accepting connections. Try: sudo systemctl start postgresql"
  ok "PostgreSQL $(psql --version | awk '{print $3}') ready"
}
install_postgres

# --------------------------------------------------------------------------
# 4. Workspace dependencies
# --------------------------------------------------------------------------
step "Installing workspace dependencies"
info "First run downloads a lot; this can take a few minutes."
(cd "$ROOT_DIR" && pnpm install)
ok "Dependencies installed"

# --------------------------------------------------------------------------
# 5. Work out the connection string
# --------------------------------------------------------------------------
DB_HOST="localhost"; DB_PORT=5432; DB_USER="postgres"
DB_PASS="vaarte_dev"; DB_NAME="vaarte"
DB_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

# If an .env already exists, respect it - never clobber existing config.
if [ -f "$DB_ENV_FILE" ]; then
  EXISTING="$(grep -E '^[[:space:]]*DATABASE_URL=' "$DB_ENV_FILE" | head -1 | sed -E 's/^[^=]*=//; s/^["'\'']//; s/["'\'']$//')"
  if [ -n "$EXISTING" ]; then
    DB_URL="$EXISTING"
    URI="${DB_URL%%\?*}"; URI="${URI#*://}"
    CREDS="${URI%%@*}"; HOSTPORT="${URI#*@}"
    DB_NAME="${HOSTPORT##*/}"; DB_USER="${CREDS%%:*}"; DB_PASS="${CREDS#*:}"
    HOSTPORT="${HOSTPORT%%/*}"; DB_HOST="${HOSTPORT%%:*}"
    if [ "$HOSTPORT" = "$DB_HOST" ]; then DB_PORT=5432; else DB_PORT="${HOSTPORT#*:}"; fi
    info "Using existing DATABASE_URL from $DB_ENV_FILE (database '$DB_NAME')"
  fi
elif have psql; then
  # No .env yet. Reuse a database that this project already created, if any,
  # so we do not orphan data by inventing a second name.
  for CANDIDATE in naarte vaarte; do
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt 2>/dev/null | cut -d'|' -f1 | tr -d ' ' | grep -qx "$CANDIDATE"; then
      DB_NAME="$CANDIDATE"
      info "Found existing database '$DB_NAME' - will use it"
      break
    fi
  done
  DB_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
fi

# --------------------------------------------------------------------------
# 6. Env files
# --------------------------------------------------------------------------
step "Writing environment files"

gen_secret() {
  if have openssl; then openssl rand -base64 32
  elif have node; then node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  else head -c 32 /dev/urandom | base64
  fi
}

if [ ! -f "$DB_ENV_FILE" ]; then
  cat > "$DB_ENV_FILE" <<EOF
# Used by the Prisma CLI (migrate / generate / seed) from packages/database.
# Must stay in sync with DATABASE_URL in apps/web/.env.local
DATABASE_URL="$DB_URL"
EOF
  ok "Created $DB_ENV_FILE"
else
  info "$DB_ENV_FILE exists - keeping it"
fi

if [ ! -f "$WEB_ENV_FILE" ]; then
  SECRET="$(gen_secret)"
  cat > "$WEB_ENV_FILE" <<EOF
# AdNexus CMS - local development environment
# Generated by setup.sh

# --- Database -------------------------------------------------------------
DATABASE_URL="$DB_URL"

# --- Auth (NextAuth v5 / Auth.js) ----------------------------------------
AUTH_SECRET="$SECRET"
NEXTAUTH_URL="http://localhost:3000"
AUTH_URL="http://localhost:3000"

# --- Player URLs ----------------------------------------------------------
NEXT_PUBLIC_PLAYER_BASE_URL="http://localhost:3000"

# --- Cloudflare R2 (optional) --------------------------------------------
# "dummy" keeps local disk uploads enabled. Fill these in to use R2.
R2_ACCOUNT_ID="dummy"
R2_ACCESS_KEY_ID="dummy"
R2_SECRET_ACCESS_KEY="dummy"
R2_BUCKET_NAME="dummy"
R2_PUBLIC_URL="dummy"

# --- Pusher (optional) ---------------------------------------------------
# "dummy" makes TVs poll instead of receiving realtime pushes.
PUSHER_APP_ID="dummy"
PUSHER_KEY="dummy"
PUSHER_SECRET="dummy"
PUSHER_CLUSTER="mt1"
NEXT_PUBLIC_PUSHER_KEY="dummy"
NEXT_PUBLIC_PUSHER_CLUSTER="mt1"
EOF
  ok "Created $WEB_ENV_FILE (generated a new AUTH_SECRET)"
else
  info "$WEB_ENV_FILE exists - keeping it"
fi

# --------------------------------------------------------------------------
# 7. Database provisioning
# --------------------------------------------------------------------------
step "Preparing database '$DB_NAME'"

if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1' >/dev/null 2>&1; then
  ok "Database '$DB_NAME' reachable - skipping creation"
else
  warn "Cannot connect with the configured credentials; provisioning the role and database."
  info "You may be prompted for your sudo password (needed to reach the postgres superuser)."
  info "If you do not know the superuser password, reset it with:"
  info "  ALTER ROLE postgres WITH PASSWORD 'your-new-password';"

  PROVISION_OK=0
  if [ "$(id -u)" -eq 0 ]; then
    PROVISION_OK=1
    PSQL_SUPER=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1)
  elif have sudo && sudo -n true 2>/dev/null; then
    PROVISION_OK=1
    PSQL_SUPER=(sudo -u "$DB_USER" psql -d postgres -v ON_ERROR_STOP=1)
  elif have sudo; then
    PSQL_SUPER=(sudo -u "$DB_USER" psql -d postgres -v ON_ERROR_STOP=1)
  else
    die "Cannot provision the database: need root or sudo."
  fi

  # NOTE: \gexec is a psql meta-command. It is only parsed when the statement
  # arrives on stdin (a heredoc). Passing it with -c forwards it to the server
  # verbatim and fails with: syntax error at or near "\"
  "${PSQL_SUPER[@]}" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASS}');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASS}');
  END IF;
END
\$\$;
SQL

  "${PSQL_SUPER[@]}" <<SQL
SELECT 'CREATE DATABASE "${DB_NAME}" OWNER "${DB_USER}" ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

  ok "Role and database '$DB_NAME' ready"
fi

# --------------------------------------------------------------------------
# 8. Migrations + seed
# --------------------------------------------------------------------------
step "Applying Prisma migrations"
(cd "$DB_DIR" && pnpm exec prisma migrate deploy)
ok "Migrations applied"

step "Seeding default users and sample data"
(cd "$DB_DIR" && pnpm exec prisma db seed)
ok "Seed complete"

# --------------------------------------------------------------------------
# 9. Done
# --------------------------------------------------------------------------
printf '\n%s===============================================%s\n' "$C_CYAN" "$C_RESET"
printf '%s Setup complete%s\n' "$C_GREEN" "$C_RESET"
printf '%s===============================================%s\n\n' "$C_CYAN" "$C_RESET"
printf '  Start the app:   ./start.sh\n'
printf '  Then open:       http://localhost:3000\n\n'
printf '  %sAdmin login:     admin@vaart.com / Admin@123%s\n' "$C_YELLOW" "$C_RESET"
printf '  %sCampaigner:      client@example.com / Client@123%s\n\n' "$C_YELLOW" "$C_RESET"
printf '  %sFirst compile takes 1-3 minutes. That is normal.%s\n\n' "$C_DIM" "$C_RESET"

if [ "$START_APP" -eq 1 ]; then
  step "Starting the dev server"
  exec "$ROOT_DIR/start.sh"
fi