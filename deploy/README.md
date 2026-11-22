# Deploy & QA — Kaliaja.coffe

Asumsi: server Linux (Ubuntu/Debian), domain `kaliaja.coffe` sudah mengarah ke IP server, kode di `/var/www/kaliaja.coffe`, MySQL + Nginx + certbot sudah terpasang. Butuh **Go ≥ 1.26** (directive `go.mod`) dan **Node.js ≥ 20.19** (Vite 8).

## 0. Provisioning otomatis (disarankan)

`deploy/setup-server.sh` menyiapkan seluruh server dari VPS Ubuntu kosong: paket sistem, Go & Node, UFW, fail2ban, update otomatis, MySQL + user khusus, schema & migrasi, `backend/.env`, build backend/frontend, seed, systemd, Nginx + SSL Let's Encrypt, cron backup, dan smoke test.

```bash
# Di VPS sebagai root, setelah DNS A record kaliaja.coffe & www mengarah ke IP server:
export DOMAIN=kaliaja.coffe LE_EMAIL=admin@kaliaja.coffe
export DB_PASS='<password-db-unik>' JWT_SECRET='<openssl rand -hex 32>'
export ADMIN_EMAIL=admin@kaliaja.coffe ADMIN_PASSWORD='<password-admin-baru>'
export BOS_EMAIL=bos@kaliaja.coffe BOS_PASSWORD='<password-bos-baru>'
export SMTP_HOST=smtp.example.com SMTP_USER=no-reply@kaliaja.coffe SMTP_PASS='<password-smtp>'

git clone <repo> /var/www/kaliaja.coffe
cd /var/www/kaliaja.coffe
bash deploy/setup-server.sh
```

Skrip ini **berulang kali aman dijalankan** (idempoten untuk sebagian besar langkah). Secara default skrip **menimpa `backend/.env`** dengan nilai produksi dari variabel lingkungan (mencegah `.env` development ikut tersalin dari lokal); gunakan `FORCE_ENV=0` hanya jika kamu memang ingin mempertahankan file yang sudah ada. Jika certbot gagal karena DNS belum aktif, jalankan lagi setelah DNS propagate. Setelah itu langkah 1–4 di bawah sudah dilakukan oleh skrip dan bisa dipakai sebagai referensi manual.

> Untuk frontend di Vercel, set `DEPLOY_MODE=api-only` dan `FRONTEND_URL=https://<project>.vercel.app`. VPS hanya menyajikan API + uploads; lihat `deploy/VERCEL.md`. Mode default `full` menyajikan frontend dari VPS memakai domain kustom.
>
> **Belum punya VPS?** Lihat `deploy/RENDER.md` + `render.yaml` + `backend/Dockerfile` untuk deploy backend gratis di Render (DB TiDB Cloud, upload Cloudinary). Frontend tetap di Vercel. Nanti bisa pindah ke VPS tanpa ubah kode frontend.

> `deploy/nginx/security-headers.conf` berisi HSTS, CSP, `nosniff`, dan header lainnya. Jangan dihapus — konfigurasi Nginx meng-include-nya di beberapa location.

## 1. Build artefak

```bash
cd /var/www/kaliaja.coffe/backend
go build -o bin/server ./cmd/server

cd ../frontend
npm ci
npm run build   # hasil: frontend/dist/
```

Salin/isi `backend/.env` untuk produksi:

```env
APP_ENV=production
APP_URL=https://kaliaja.coffe
ALLOWED_ORIGIN=https://kaliaja.coffe
COOKIE_SECURE=true
JWT_SECRET=<rahasia-unik-minimal-32-karakter-dari-generator>
DB_HOST=127.0.0.1
DB_USER=<user-db-produksi>
DB_PASS=<password-db-produksi>
DB_NAME=kaliaja_coffe
UPLOAD_DIR=./uploads
SMTP_HOST=<smtp-produksi>
SMTP_PORT=587
SMTP_USER=<user-smtp>
SMTP_PASS=<password-smtp>
SMTP_FROM=no-reply@kaliaja.coffe
SEED_ADMIN_EMAIL=admin@kaliaja.coffe
SEED_ADMIN_PASSWORD=<password-admin-baru>
SEED_BOS_EMAIL=bos@kaliaja.coffe
SEED_BOS_PASSWORD=<password-bos-baru>
```

> **Wajib:** jangan pakai `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, atau
> `SEED_BOS_PASSWORD` dari `.env.example`. Aplikasi akan menolak start/seeding
> di produksi jika nilai contoh masih dipakai. `SMTP_HOST` juga wajib diisi agar
> token reset password tidak ditulis ke log.

Import schema + migrasi struk sebelum start:

```bash
mysql -u root -p < db/schema.sql
mysql -u root -p < db/migrations/001_add_receipt_url.sql
go run ./cmd/server -seed   # hanya sekali, untuk akun admin/bos awal
```

## 2. Systemd

```bash
sudo cp deploy/systemd/kaliaja-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kaliaja-api
sudo systemctl status kaliaja-api
```

## 3. Nginx + HTTPS

```bash
sudo mkdir -p /var/www/certbot
sudo ln -s /var/www/kaliaja.coffe/deploy/nginx/kaliaja.coffe.conf /etc/nginx/sites-enabled/kaliaja.coffe
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d kaliaja.coffe -d www.kaliaja.coffe
sudo certbot renew --dry-run
```

Perhatian: `/uploads/` dilayani langsung oleh Nginx dengan tipe gambar yang benar (`image/jpeg`, `image/png`, `image/gif`, `image/webp`) dan `application/octet-stream` untuk file lainnya. Script dilarang dieksekusi, dan tidak ada fallback ke `index.html`.

## 4. Backup MySQL

```bash
sudo mkdir -p /var/backups/kaliaja-coffe/mysql
sudo chmod +x deploy/backup/backup-mysql.sh deploy/smoke-test.sh

# crontab -e
0 2 * * * /var/www/kaliaja.coffe/deploy/backup/backup-mysql.sh >> /var/log/kaliaja-backup.log 2>&1
```

Default retensi: 14 hari. Bisa diubah lewat `RETENTION_DAYS`.

## 5. QA

Di mesin development / CI:

```bash
# Backend
cd backend
go vet ./...
go run golang.org/x/vuln/cmd/govulncheck@latest ./...

# Frontend
cd ../frontend
npm ci
npm audit --audit-level=moderate
npm run build
```

### Smoke test pasca-deploy (Tahap 3 PRD)

Jalankan setelah aplikasi live di `https://kaliaja.coffe`:

```bash
BASE_URL=https://kaliaja.coffe \
SMOKE_ADMIN_EMAIL=admin@kaliaja.coffe SMOKE_ADMIN_PASSWORD='<password-admin>' \
SMOKE_BOS_EMAIL=bos@kaliaja.coffe SMOKE_BOS_PASSWORD='<password-bos>' \
SMOKE_CUSTOMER_EMAIL='<email-customer>' SMOKE_CUSTOMER_PASSWORD='<password-customer>' \
RECEIPT_PATH=/uploads/receipts/<nama-file>.jpg \
deploy/smoke-test.sh
```

Variabel opsional:

| Variabel | Fungsi |
| :--- | :--- |
| `BASE_URL`, `HOST_HEADER` | Target pengujian & host untuk cek redirect HTTP→HTTPS |
| `TIMEOUT` | Timeout curl per request (default 15 detik) |
| `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD` | Uji login admin, daftar transaksi, RBAC, dan upload struk |
| `SMOKE_BOS_EMAIL` / `SMOKE_BOS_PASSWORD` | Uji rekap transaksi & stok BOS, RBAC |
| `SMOKE_CUSTOMER_EMAIL` / `SMOKE_CUSTOMER_PASSWORD` | Uji RBAC customer |
| `RECEIPT_PATH` | Cek Content-Type & header `nosniff` file struk yang sudah ada |
| `SMOKE_TRANSACTION_ID`, `SMOKE_RECEIPT_FILE` | Uji penuh unggah→muncul di Admin/BOS→hapus struk pada transaksi tertentu |

Cakupan smoke test: redirect HTTPS + HSTS, halaman & semua route SPA (termasuk dashboard Admin/BOS), endpoint publik, logo/favicon, RBAC admin/BOS/customer (termasuk penolakan `POST` ilegal), sanitasi error, Content-Type upload, dan alur struk. Kredensial hanya dipakai lewat cookie jar sementara yang dihapus setelah selesai. Pengecekan `nosniff` pada file statik dijalankan hanya saat `BASE_URL` HTTPS (di dev/Vite header tersebut memang tidak diset).

Simulasi lokal (XAMPP + Vite + Go, tanpa produksi):

```bash
BASE_URL=http://127.0.0.1:5173 \
SMOKE_ADMIN_EMAIL=admin@kaliaja.coffe SMOKE_ADMIN_PASSWORD='Admin123!' \
SMOKE_BOS_EMAIL=bos@kaliaja.coffe SMOKE_BOS_PASSWORD='Bos123!' \
SMOKE_CUSTOMER_EMAIL='<email-customer>' SMOKE_CUSTOMER_PASSWORD='<password>' \
SMOKE_TRANSACTION_ID=1 SMOKE_RECEIPT_FILE='backend/uploads/products/<foto>.jpg' \
bash deploy/smoke-test.sh
```

> Rate limiter endpoint auth memberi 5 token per menit per IP. Jika beberapa login berturut-turut kena `429`, tunggu sekitar 12 detik antar percobaan sebelum mengulang smoke test.
