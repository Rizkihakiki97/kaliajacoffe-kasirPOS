#!/usr/bin/env bash
# Provisioning server produksi Kaliaja.coffee (Ubuntu 22.04/24.04).
#
# Contoh pemakaian di VPS (jalankan sebagai root):
#   export DOMAIN=kaliaja.coffe LE_EMAIL=admin@kaliaja.coffe \
#     DB_PASS='...' JWT_SECRET='...' \
#     ADMIN_EMAIL=admin@kaliaja.coffe ADMIN_PASSWORD='...' \
#     BOS_EMAIL=bos@kaliaja.coffe BOS_PASSWORD='...'
#   bash deploy/setup-server.sh
#
# Variabel opsional: APP_DIR, DB_USER, GO_VERSION, NODE_MAJOR, RUN_SMOKE=0,
# HARDEN_MYSQL=0, FORCE_ENV=1.
set -Eeuo pipefail

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n[WARN] %s\n' "$*" >&2; }
fail() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Validasi konfigurasi
# ---------------------------------------------------------------------------
: "${DOMAIN:?DOMAIN wajib, contoh: kaliaja.coffe}"
: "${LE_EMAIL:?LE_EMAIL wajib untuk sertifikat SSL}"
: "${DB_PASS:?DB_PASS wajib}"
: "${JWT_SECRET:?JWT_SECRET wajib}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL wajib}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD wajib}"
: "${BOS_EMAIL:?BOS_EMAIL wajib}"
: "${BOS_PASSWORD:?BOS_PASSWORD wajib}"
: "${SMTP_HOST:?SMTP_HOST wajib di produksi agar token reset tidak masuk log}"

APP_DIR="${APP_DIR:-/var/www/kaliaja.coffe}"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DEPLOY_MODE="${DEPLOY_MODE:-full}" # full | api-only
FRONTEND_URL="${FRONTEND_URL:-https://kaliaja.coffe.vercel.app}"
DB_NAME="kaliaja_coffe" # schema.sql menggunakan nama ini
DB_USER="${DB_USER:-kaliaja_app}"
DB_HOST="127.0.0.1"
DB_PORT="3306"
GO_VERSION="${GO_VERSION:-1.26.0}"
NODE_MAJOR="${NODE_MAJOR:-22}"
RUN_SMOKE="${RUN_SMOKE:-1}"
HARDEN_MYSQL="${HARDEN_MYSQL:-1}"
# Selalu tulis .env produksi (jangan sampai .env development ikut tersalin).
FORCE_ENV="${FORCE_ENV:-1}"
SMOKE_ADMIN_EMAIL="$ADMIN_EMAIL"
SMOKE_ADMIN_PASSWORD="$ADMIN_PASSWORD"
SMOKE_BOS_EMAIL="$BOS_EMAIL"
SMOKE_BOS_PASSWORD="$BOS_PASSWORD"

[[ $EUID -eq 0 ]] || fail "Jalankan sebagai root (sudo bash deploy/setup-server.sh)."
[[ "$DEPLOY_MODE" == "full" || "$DEPLOY_MODE" == "api-only" ]] || fail "DEPLOY_MODE harus full atau api-only."
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "DOMAIN tidak valid: $DOMAIN"
[[ "$FRONTEND_URL" =~ ^https:// ]] || fail "FRONTEND_URL harus https:// (URL Vercel)."
[[ ${#JWT_SECRET} -ge 32 ]] || fail "JWT_SECRET minimal 32 karakter."
[[ "$JWT_SECRET" != "dev-only-change-this-secret-kaliaja-coffe-2026" ]] || fail "JWT_SECRET masih nilai contoh."
[[ "$ADMIN_PASSWORD" != "Admin123!" && "$BOS_PASSWORD" != "Bos123!" ]] || fail "Password seed masih nilai contoh."
[[ "$DB_USER" =~ ^[A-Za-z0-9_]+$ ]] || fail "DB_USER hanya boleh huruf/angka/underscore."
[[ -f "$REPO_DIR/db/schema.sql" ]] || fail "Repo tidak ditemukan di $REPO_DIR"

sql_quote() { printf "'%s'" "${1//\'/\'\'}"; }

if [[ "$DEPLOY_MODE" == "api-only" ]]; then
  PUBLIC_URL="$FRONTEND_URL"
  NGINX_TEMPLATE="api-only.conf"
else
  PUBLIC_URL="https://$DOMAIN"
  NGINX_TEMPLATE="kaliaja.coffe.conf"
fi
log "Konfigurasi: mode=$DEPLOY_MODE, domain-api=$DOMAIN, frontend=$PUBLIC_URL, app=$APP_DIR, user-db=$DB_USER"

# ---------------------------------------------------------------------------
# 2. Paket sistem
# ---------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
log "Install paket sistem"
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl wget git unzip gnupg ufw fail2ban cron \
  unattended-upgrades nginx mysql-server \
  python3-certbot-nginx >/dev/null

# ---------------------------------------------------------------------------
# 3. Go & Node.js
# ---------------------------------------------------------------------------
log "Install Go $GO_VERSION bila belum ada"
if ! command -v go >/dev/null 2>&1 || [[ "$(go env GOVERSION 2>/dev/null || true)" != "go${GO_VERSION}" ]]; then
  GO_ARCH="amd64"
  case "$(uname -m)" in
    aarch64|arm64) GO_ARCH="arm64" ;;
  esac
  wget -q "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -O /tmp/kaliaja-go.tar.gz
  rm -rf /usr/local/go
  tar -C /usr/local -xzf /tmp/kaliaja-go.tar.gz
  rm -f /tmp/kaliaja-go.tar.gz
fi
ln -sf /usr/local/go/bin/go /usr/local/bin/go
export PATH="/usr/local/go/bin:$PATH"
go version

log "Install Node.js $NODE_MAJOR.x"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)" != "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node --version
npm --version

# ---------------------------------------------------------------------------
# 4. Firewall, fail2ban, security updates
# ---------------------------------------------------------------------------
log "Aktifkan firewall & hardening dasar"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

mkdir -p /etc/fail2ban/jail.d
cat > /etc/fail2ban/jail.d/kaliaja.conf <<'EOF'
[sshd]
enabled = true
port = ssh
maxretry = 5
bantime = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban >/dev/null 2>&1 || true

dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
systemctl enable --now cron >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 5. Database: user khusus, schema, migrasi
# ---------------------------------------------------------------------------
log "Siapkan MySQL"
systemctl enable --now mysql >/dev/null 2>&1 || systemctl enable --now mariadb >/dev/null 2>&1 || true

mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY $(sql_quote "$DB_PASS");
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY $(sql_quote "$DB_PASS");
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

if [[ "$HARDEN_MYSQL" == "1" ]]; then
  mysql <<'SQL'
DELETE FROM mysql.user WHERE User = '';
DELETE FROM mysql.user WHERE User = 'root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
FLUSH PRIVILEGES;
SQL
fi

mysql < "$REPO_DIR/db/schema.sql"
mysql < "$REPO_DIR/db/migrations/001_add_receipt_url.sql"

# ---------------------------------------------------------------------------
# 6. Salin kode & buat .env produksi
# ---------------------------------------------------------------------------
log "Salin aplikasi ke $APP_DIR"
mkdir -p "$APP_DIR"
if [[ "$(cd "$REPO_DIR" && pwd -P)" != "$(cd "$APP_DIR" && pwd -P)" ]]; then
  cp -a "$REPO_DIR/." "$APP_DIR/"
else
  warn "REPO_DIR dan APP_DIR sama; tidak perlu menyalin."
fi

ENV_FILE="$APP_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" || "$FORCE_ENV" == "1" ]]; then
  cat > "$ENV_FILE" <<EOF
APP_ENV=production
APP_PORT=8080
APP_URL=$PUBLIC_URL
ALLOWED_ORIGIN=$PUBLIC_URL

DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASS=$DB_PASS
DB_NAME=$DB_NAME

JWT_SECRET=$JWT_SECRET
JWT_EXPIRY_HOURS=24
COOKIE_SECURE=true
TRUSTED_PROXIES=127.0.0.1

UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=5

SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_FROM=${SMTP_FROM:-no-reply@$DOMAIN}

SEED_ADMIN_EMAIL=$ADMIN_EMAIL
SEED_ADMIN_PASSWORD=$ADMIN_PASSWORD
SEED_BOS_EMAIL=$BOS_EMAIL
SEED_BOS_PASSWORD=$BOS_PASSWORD
EOF
else
  warn "backend/.env tidak ditimpa karena FORCE_ENV=0. Pastikan isinya bukan .env development."
fi
chown www-data:www-data "$ENV_FILE"
chmod 600 "$ENV_FILE"

for folder in products activities receipts branding; do
  mkdir -p "$APP_DIR/backend/uploads/$folder"
done
chown -R www-data:www-data "$APP_DIR/backend/uploads"
find "$APP_DIR/backend/uploads" -type d -exec chmod 755 {} +
find "$APP_DIR/backend/uploads" -type f -exec chmod 644 {} +

# ---------------------------------------------------------------------------
# 7. Build backend & frontend
# ---------------------------------------------------------------------------
log "Build backend"
cd "$APP_DIR/backend"
go mod download
go vet ./...
CGO_ENABLED=0 go build -trimpath -o bin/server ./cmd/server

log "Seed akun admin/BOS (aman dijalankan ulang)"
./bin/server -seed

if [[ "$DEPLOY_MODE" == "full" ]]; then
  log "Build frontend (dilayani Nginx)"
  cd "$APP_DIR/frontend"
  npm ci --no-audit --no-fund
  npm run build
  chown -R www-data:www-data "$APP_DIR/frontend/dist"
else
  log "Lewati build frontend — frontend dilayani Vercel"
fi

# ---------------------------------------------------------------------------
# 8. Systemd
# ---------------------------------------------------------------------------
log "Pasang service systemd"
sed "s#/var/www/kaliaja.coffe#$APP_DIR#g" \
  "$APP_DIR/deploy/systemd/kaliaja-api.service" \
  > /etc/systemd/system/kaliaja-api.service
systemctl daemon-reload
systemctl enable --now kaliaja-api
sleep 2
systemctl --no-pager --full status kaliaja-api | sed -n '1,12p' || true

# ---------------------------------------------------------------------------
# 9. Nginx + SSL
# ---------------------------------------------------------------------------
log "Siapkan Nginx bootstrap (port 80) untuk certbot"
mkdir -p /var/www/certbot
if [[ "$DEPLOY_MODE" == "full" ]]; then
  SERVER_NAMES="$DOMAIN www.$DOMAIN"
else
  SERVER_NAMES="$DOMAIN"
fi
cat > /etc/nginx/sites-available/kaliaja.coffe <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAMES;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 404;
    }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/kaliaja.coffe /etc/nginx/sites-enabled/kaliaja.coffe
nginx -t
systemctl reload nginx

CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [[ ! -f "$CERT_PATH" ]]; then
  log "Minta sertifikat Let's Encrypt"
  if [[ "$DEPLOY_MODE" == "full" ]]; then
    CERT_DOMAINS=(-d "$DOMAIN" -d "www.$DOMAIN")
  else
    CERT_DOMAINS=(-d "$DOMAIN")
  fi
  certbot certonly --webroot -w /var/www/certbot \
    "${CERT_DOMAINS[@]}" \
    --non-interactive --agree-tos -m "$LE_EMAIL" --keep-until-expiring \
    || warn "Certbot gagal (cek DNS A record ke IP server). Nginx tetap berjalan di HTTP."
fi

if [[ -f "$CERT_PATH" ]]; then
  log "Pasang konfigurasi Nginx final (HTTPS + hardening)"
  sed -e "s#kaliaja.coffe#$DOMAIN#g" \
      -e "s#/var/www/kaliaja.coffe#$APP_DIR#g" \
      "$APP_DIR/deploy/nginx/$NGINX_TEMPLATE" \
      > /etc/nginx/sites-available/kaliaja.coffe
  nginx -t
  systemctl reload nginx
else
  warn "Konfigurasi HTTPS belum dipasang karena sertifikat belum tersedia."
fi

# ---------------------------------------------------------------------------
# 10. Backup otomatis
# ---------------------------------------------------------------------------
log "Pasang cron backup MySQL"
mkdir -p /var/backups/kaliaja-coffe/mysql
chmod +x "$APP_DIR/deploy/backup/backup-mysql.sh" "$APP_DIR/deploy/smoke-test.sh"
CRON_LINE="0 2 * * * $APP_DIR/deploy/backup/backup-mysql.sh >> /var/log/kaliaja-backup.log 2>&1"
if ! crontab -l 2>/dev/null | grep -Fq "$APP_DIR/deploy/backup/backup-mysql.sh"; then
  (crontab -l 2>/dev/null || true; printf '%s\n' "$CRON_LINE") | crontab -
fi

# ---------------------------------------------------------------------------
# 11. Smoke test bila HTTPS sudah aktif
# ---------------------------------------------------------------------------
if [[ "$RUN_SMOKE" == "1" && -f "$CERT_PATH" ]]; then
  log "Jalankan smoke test pasca-deploy"
  SMOKE_EXTRA_ENV=()
  if [[ "$DEPLOY_MODE" == "api-only" ]]; then
    SMOKE_EXTRA_ENV=(STATIC_NOSNIFF=0 SKIP_PAGE_HEADER_CHECKS=1)
    if [[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://$DOMAIN/api/branding" || true)" != "200" ]]; then
      warn "Endpoint API langsung di https://$DOMAIN belum merespons 200."
    else
      log "Endpoint API langsung https://$DOMAIN/api/branding: 200"
    fi
  fi
  env BASE_URL="$PUBLIC_URL" HOST_HEADER="$DOMAIN" \
    SMOKE_ADMIN_EMAIL="$SMOKE_ADMIN_EMAIL" SMOKE_ADMIN_PASSWORD="$SMOKE_ADMIN_PASSWORD" \
    SMOKE_BOS_EMAIL="$SMOKE_BOS_EMAIL" SMOKE_BOS_PASSWORD="$SMOKE_BOS_PASSWORD" \
    "${SMOKE_EXTRA_ENV[@]}" \
    bash "$APP_DIR/deploy/smoke-test.sh" || warn "Smoke test belum lulus — lihat output di atas."
else
  warn "Smoke test dilewati (RUN_SMOKE=0 atau HTTPS belum aktif)."
fi

log "Selesai"
echo "API         : https://$DOMAIN"
echo "Frontend    : $PUBLIC_URL"
echo "API service : systemctl status kaliaja-api"
echo "Log Nginx   : tail -f /var/log/nginx/error.log"
echo "Backup      : /var/backups/kaliaja-coffe/mysql"
