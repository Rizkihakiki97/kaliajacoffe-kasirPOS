#!/usr/bin/env bash
# Backup MySQL Kaliaja.coffe dengan retensi harian.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/var/www/kaliaja.coffe/backend/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kaliaja-coffe/mysql}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

env_get() {
  sed -n "s/^$1=\(.*\)$/\1/p" "$ENV_FILE" \
    | head -n 1 \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

DB_HOST="$(env_get DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="$(env_get DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
DB_USER="$(env_get DB_USER)"; DB_USER="${DB_USER:-root}"
DB_PASS="$(env_get DB_PASS)"
DB_NAME="$(env_get DB_NAME)"; DB_NAME="${DB_NAME:-kaliaja_coffe}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ENV_FILE tidak ditemukan: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
TMP_FILE="$(mktemp "$BACKUP_DIR/.${DB_NAME}-${STAMP}.XXXXXX.sql.gz")"
trap 'rm -f "$TMP_FILE"' EXIT

MYSQL_PWD="$DB_PASS" mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "$DB_NAME" | gzip -9 > "$TMP_FILE"

FINAL_FILE="$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"
mv "$TMP_FILE" "$FINAL_FILE"
trap - EXIT
chmod 600 "$FINAL_FILE"

find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_NAME}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "Backup selesai: $FINAL_FILE"
