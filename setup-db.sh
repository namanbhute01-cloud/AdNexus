#!/bin/bash
set -euo pipefail

# Idempotent local database bootstrap for the AdNexus / Vaart-E CMS.
#
# Creates the database if it is missing, applies the checked-in Prisma
# migrations, and seeds the default admin + sample data. Safe to re-run.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$ROOT_DIR/packages/database"
DB_ENV_FILE="$DB_DIR/.env"

if [ ! -f "$DB_ENV_FILE" ]; then
  echo "ERROR: Missing $DB_ENV_FILE"
  echo "Create it with a valid DATABASE_URL first."
  exit 1
fi

DATABASE_URL_LINE="$(grep '^[[:space:]]*DATABASE_URL=' "$DB_ENV_FILE" || true)"
if [ -z "$DATABASE_URL_LINE" ]; then
  echo "ERROR: DATABASE_URL not found in $DB_ENV_FILE"
  exit 1
fi

DATABASE_URL="${DATABASE_URL_LINE#DATABASE_URL=}"
DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"
DATABASE_URL="${DATABASE_URL%\'}"; DATABASE_URL="${DATABASE_URL#\'}"

# Parse postgresql://USER:PASSWORD@HOST:PORT/DBNAME
DB_URI="${DATABASE_URL%%\?*}"
DB_URI="${DB_URI#*://}"
DB_CREDS="${DB_URI%%@*}"
DB_HOSTPORT="${DB_URI#*@}"
DB_NAME="${DB_HOSTPORT##*/}"
DB_USER="${DB_CREDS%%:*}"
DB_PASS="${DB_CREDS#*:}"
# DB_HOSTPORT is "host:port/dbname" — strip the db path before splitting host/port.
DB_HOSTPORT="${DB_HOSTPORT%%/*}"
DB_HOST="${DB_HOSTPORT%%:*}"
if [ "$DB_HOSTPORT" = "$DB_HOST" ]; then
  DB_PORT=5432
else
  DB_PORT="${DB_HOSTPORT#*:}"
fi

if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  echo "ERROR: Could not parse DATABASE_URL: $DATABASE_URL"
  exit 1
fi

echo "--- Database bootstrap ---"
echo "Host: $DB_HOST:$DB_PORT   Database: $DB_NAME   Role: $DB_USER"

# If we can already connect with the credentials from .env, skip provisioning.
if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "Database '$DB_NAME' is reachable with the configured credentials. Skipping provisioning."
else
  echo "Cannot connect yet. Provisioning the database..."
  echo "This step needs local superuser access (sudo) and may prompt for your password."

  sudo -u "$DB_USER" psql -v ON_ERROR_STOP=1 --dbname=postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASS}');
    RAISE NOTICE 'Created role ${DB_USER}';
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '${DB_USER}', '${DB_PASS}');
    RAISE NOTICE 'Updated password for role ${DB_USER}';
  END IF;
END
\$\$;
SQL

  # NOTE: \gexec is a psql meta-command. It only works when psql reads the
  # statement from stdin (a heredoc) -- passing it via `-c` forwards it to the
  # server verbatim and produces "syntax error at or near \"".
  sudo -u "$DB_USER" psql -v ON_ERROR_STOP=1 --dbname=postgres <<SQL
SELECT 'CREATE DATABASE "${DB_NAME}" OWNER "${DB_USER}" ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

  echo "Provisioned database '$DB_NAME'."
fi

cd "$DB_DIR"

echo "Applying Prisma migrations..."
npx prisma migrate deploy

echo "Seeding default admin and sample data..."
npx prisma db seed

echo
echo "--- Setup Complete ---"
echo "Admin login:     admin@vaart.com  / Admin@123"
echo "Campaigner login: client@example.com / Client@123"
echo
echo "Start the app with: ./start.sh"