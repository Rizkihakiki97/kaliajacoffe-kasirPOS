# Kaliaja.coffe — POS & Pemesanan Kafe

Implementasi awal berdasarkan `PRD.MD`. Saat ini fondasi yang sudah dibuat:

- `db/schema.sql` — 7 tabel MySQL sesuai PRD + seed 3 kategori dan branding (termasuk kolom `receipt_url` untuk upload struk).
- `db/migrations/001_add_receipt_url.sql` — migrasi aman untuk database yang sudah dibuat sebelum fitur struk ditambahkan.
- `backend/` — REST API Golang (Gin + GORM) dengan RBAC, JWT cookie, validasi upload, rate limiting, transaksi dengan pengurangan stok otomatis, dan upload struk.
- `frontend/` — ReactJS (Vite) untuk landing page, katalog + order, auth, dashboard Admin (produk, kegiatan, POS, upload struk), dan dashboard BOS (rekap transaksi, stok, branding).

## Struktur

```
.
├── PRD.MD
├── db/
│   ├── schema.sql
│   └── migrations/
│       └── 001_add_receipt_url.sql
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js      # proxy /api & /uploads ke localhost:8080 saat dev
│   └── src/
│       ├── api/            # client fetch (credentials: include, FormData)
│       ├── components/     # layout publik, layout dashboard, UI dasar
│       ├── context/        # auth, branding, keranjang, toast
│       ├── pages/          # landing, menu/order, auth, admin/, bos/
│       └── styles/         # CSS tema kafe (responsive)
└── backend/
    ├── .env.example
    ├── go.mod
    ├── cmd/server/main.go
    └── internal/
        ├── config/     # env & konfigurasi
        ├── database/   # koneksi MySQL (schema sumber kebenaran: db/schema.sql)
        ├── handlers/   # auth, branding, products, activities, transactions, receipts, bos
        ├── middleware/ # JWT, RBAC, rate limit, header, batas body
        ├── models/     # struct GORM
        ├── routes/     # pemetaan endpoint
        ├── seed/       # akun admin/bos awal
        └── utils/      # response JSON & upload aman
```

## Cara menjalankan (lokal / XAMPP)

1. **Install Go** ≥ 1.26 (sesuai directive `go.mod`, setelah dependency keamanan diperbarui): https://go.dev/dl/
2. Pastikan MySQL XAMPP berjalan. Import schema:
   ```powershell
   & 'C:\xampp\mysql\bin\mysql.exe' -u root -p < db\schema.sql
   ```
   Jika database sudah ada dari versi sebelumnya, jalankan juga migrasi struk:
   ```powershell
   & 'C:\xampp\mysql\bin\mysql.exe' -u root -p < db\migrations\001_add_receipt_url.sql
   ```
3. Buat file env:
   ```powershell
   copy backend\.env.example backend\.env
   ```
4. Install dependency & seed akun awal:
   ```powershell
   cd backend
   go mod tidy
   go run ./cmd/server -seed
   ```
5. Jalankan API:
   ```powershell
   go run ./cmd/server
   ```
   Atau build binary lalu jalankan sebagai proses tersendiri (disarankan agar tidak terhenti saat terminal ditutup):
   ```powershell
   go build -o bin/server.exe ./cmd/server
   Start-Process -FilePath '.\bin\server.exe' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden
   ```

Akun seed (bisa diubah di `.env`):

| Role | Email | Password |
| :--- | :--- | :--- |
| Admin | `admin@kaliaja.coffe` | `Admin123!` |
| BOS | `bos@kaliaja.coffe` | `Bos123!` |

> Saat `SMTP_HOST` kosong, token reset password dicetak di terminal (mode dev). Isi SMTP untuk produksi.

> **Penting:** `AutoMigrate` GORM sengaja dimatikan. Schema tabel, index, FK, dan constraint sepenuhnya bersumber dari `db/schema.sql` + file di `db/migrations/`. Jalankan keduanya sebelum menjalankan API.

## Menjalankan frontend (ReactJS)

Butuh Node.js ≥ 20.19 (Vite 8).

```powershell
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173`. Vite meneruskan `/api` dan `/uploads` ke `http://localhost:8080`, jadi cookie HttpOnly tetap bekerja tanpa konfigurasi CORS tambahan di browser. Untuk build produksi: `npm run build` (hasil di `frontend/dist/`).

> Catatan frontend:
> - Kategori diambil dari `GET /api/categories` (fallback seed `db/schema.sql` bila API belum tersedia), jadi ID tidak lagi di-hardcode di form produk/filter menu.
> - Endpoint PUT produk/kegiatan/branding memakai `multipart/form-data` (`formValue` di backend), sehingga frontend selalu mengirim `FormData`, termasuk untuk field teks.
> - Daftar transaksi di halaman Admin diambil dari `GET /api/transactions` (role `admin`), lengkap dengan filter sumber/status, pencarian ID/invoice, dan `receipt_url`. Upload struk langsung menyegarkan daftar dari backend.
> - Logo kopi bawaan ada di `frontend/public/images/logo-kopi-kaliaja.png` (asli 1254×1254). Dari file itu dibuat versi ringan `logo-kopi-kaliaja-128.png` untuk navbar/sidebar dan `favicon.png` untuk tab browser. Logo/favicon yang diunggah BOS tetap menggantikan keduanya lewat endpoint `/api/branding`.

## Endpoint yang tersedia

| Modul | Method & Endpoint | Role |
| :--- | :--- | :--- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/auth/logout`, `GET /api/auth/session`, `GET /api/auth/me` | publik / terautentikasi |
| Branding | `GET /api/branding` | publik |
| Branding | `PUT /api/branding` | bos |
| Kategori | `GET /api/categories` | publik |
| Produk | `GET /api/products` | publik |
| Produk | `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id` | admin |
| Kegiatan | `GET /api/activities` | publik |
| Kegiatan | `POST /api/activities`, `PUT /api/activities/:id`, `DELETE /api/activities/:id` | admin |
| Transaksi | `GET /api/transactions` (`source`, `status`, `flow_type`, `start`, `end`, `q`) | admin |
| Transaksi | `POST /api/transactions/pos` | admin |
| Transaksi | `POST /api/transactions/order` | customer |
| Transaksi | `POST /api/transactions/:id/receipt` (unggah/ganti struk), `DELETE /api/transactions/:id/receipt` | admin |
| Monitoring | `GET /api/bos/transactions`, `GET /api/bos/stocks` | bos |

Contoh body transaksi:

```json
{
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ]
}
```

`customer_id` opsional hanya untuk endpoint POS; endpoint order selalu memakai ID akun yang login.

Struk diunggah setelah transaksi dibuat, dengan `multipart/form-data` dan field bernama `receipt`:
```powershell
curl -X POST http://localhost:8080/api/transactions/1/receipt `
  -H "Authorization: Bearer <token>" `
  -F "receipt=@C:\path\bukti-bayar.jpg"
```
URL struk (`receipt_url`) ikut dikembalikan pada response transaksi, endpoint `POST /transactions/pos`, `POST /transactions/order`, `GET /api/transactions` (Admin), dan `GET /api/bos/transactions`. Response list transaksi berbentuk `{ summary, transactions[] }` dengan `items[]` di tiap transaksi; ringkasan mengikuti filter yang dipakai.

## Keputusan / asumsi implementasi

1. **Transaksi masuk & keluar**: `source = order` (pesanan customer) ⇒ `flow_type = in`; `source = pos` (kasir admin) ⇒ `flow_type = out`. Ini konsisten dengan field `source` di PRD dan tidak menambah modul restock.
2. **Stok**: hanya diubah admin lewat CRUD produk dan berkurang otomatis via transaksi. Tidak ada endpoint restock/penyesuaian manual, sesuai catatan PRD.
3. **Upload**: JPG/PNG/GIF/WEBP, cek magic bytes, UUID, batas 5 MB, disimpan di `backend/uploads/...` dan dilayani di `/uploads/...`. SVG ditolak karena risiko XSS. Aturan yang sama dipakai untuk foto produk, foto kegiatan, logo/favicon, **dan struk** (`uploads/receipts/`).
4. **Reset password**: token SHA-256 disimpan di DB, token mentah dikirim via email/SMTP, kedaluwarsa 15 menit dan sekali pakai.
5. **Status transaksi**: langsung `completed` saat transaksi dibuat (PRD tidak mendefinisikan alur pending/cancel).
6. **Produk yang sudah dipakai transaksi tidak bisa dihapus** agar riwayat transaksi tetap utuh.
7. Endpoint tambahan: `GET /api/auth/session` (selalu `200`, dipakai frontend saat bootstrap agar tamu tidak memicu `401` di Network tab), `GET /api/auth/me` (tetap protektif, untuk keperluan API/RBAC), dan `POST /api/auth/logout`.
8. **Upload struk**: **Admin** yang mengunggah/mengganti/menghapus struk sebagai **bukti pembayaran untuk customer**, baik untuk transaksi kasir (POS) maupun pesanan customer (`order`). Struk **opsional** dan diunggah lewat endpoint terpisah setelah transaksi dibuat. Format gambar saja (JPG/PNG/GIF/WEBP). File lama otomatis dihapus saat diganti. Sesuai penambahan kalimat "ada upload struk" di §1 poin 2 PRD.

## Deploy & QA

- `deploy/setup-server.sh` — provisioning VPS Ubuntu kosong (paket, Go/Node, firewall, fail2ban, MySQL, build, systemd, Nginx+SSL, backup, smoke test) dari environment variables.
- `backend/.env.production.example` — template konfigurasi produksi (tanpa secret asli).
- `deploy/nginx/kaliaja.coffe.conf` — reverse proxy, redirect HTTPS, rate limit auth, gzip/cache, dan pelayanan `/uploads/` yang aman.
- `deploy/nginx/security-headers.conf` — HSTS, CSP, `nosniff`, dan header keamanan lain.
- `deploy/systemd/kaliaja-api.service` — service Golang dengan hardening dasar.
- `deploy/backup/backup-mysql.sh` — mysqldump + gzip dengan retensi 14 hari.
- `deploy/smoke-test.sh` — pengecekan live pasca-deploy (HTTPS, endpoint publik, RBAC, Content-Type upload).
- `deploy/VERCEL.md` + `frontend/vercel.json.example` — panduan jika frontend tetap di Vercel dan backend/DB di VPS (rewrite `/api` & `/uploads` agar cookie tetap satu-origin).
- `render.yaml` + `backend/Dockerfile` + `deploy/RENDER.md` — **Opsi 1 (gratis dulu)**: frontend Vercel, backend di Render, DB TiDB Cloud Serverless, gambar/struk di Cloudinary (`STORAGE_DRIVER=cloudinary`).
- Petunjuk lengkap ada di `deploy/README.md`. Eksekusi final tetap membutuhkan akses ke server produksi.

Status QA lokal: `go vet ./...` ✅, `go build ./...` ✅, `govulncheck ./...` → 0 kerentanan ✅ (`golang.org/x/net`, `x/text`, `x/crypto`, dan `jwt/v5` sudah diperbarui), `npm run build` ✅, `npm audit` → 0 kerentanan ✅. Integrasi lokal menyeluruh ✅: register/login/`me`/logout/forgot/reset password (cookie HttpOnly), RBAC admin/BOS/customer, CRUD produk & kegiatan, transaksi POS/order + stok + anti-IDOR, upload/replace/delete struk dan file statis, branding BOS, kategori publik, daftar transaksi Admin, render semua route publik, serta halaman Admin Transactions terautentikasi lewat CDP. Bug yang ditemukan dan diperbaiki saat integrasi: GORM mengubah struct setelah `Update`/`Updates` sehingga file lama tidak terhapus (produk/kegiatan/branding) atau file baru ikut terhapus (struk), dan rate limiter yang sebelumnya kena `GET /auth/me` sehingga sesi valid bisa terkena 429. Data uji sudah dibersihkan. Fitur cetak struk customer juga sudah diuji end-to-end lewat CDP: halaman sukses order menampilkan struk berisi invoice/waktu/item/total, tombol **Cetak Struk** memanggil `window.print()`, dan `@media print` menyembunyikan seluruh UI kecuali area struk.

Hardening lanjutan hasil audit: whitelist `APP_ENV` (`dev|staging|production`) + validasi gagal-cepat untuk `JWT_SECRET`, `COOKIE_SECURE`, `ALLOWED_ORIGIN`, dan `SMTP_HOST` di produksi; `TRUSTED_PROXIES` bisa dikonfigurasi; algoritma JWT dipin ke HS256; cookie logout memakai `CookieSecure`; detail error upload tidak bocor ke klien (dicatat di log server); urutan lock stok diurutkan untuk mencegah deadlock; `invoice_code` 8 byte; HTTP server punya timeout & graceful shutdown. Setelah perubahan ini QA diulang: `go vet` ✅, `go build` ✅, `govulncheck` 0 ✅, `npm audit` 0 ✅, `npm run build` ✅, smoke test lokal **51 PASS, 0 FAIL** ✅. Dukungan Render gratis (`STORAGE_DRIVER=cloudinary`, `DB_TLS`, fallback `PORT`, health check `/health`, Dockerfile, `.dockerignore`) juga sudah di-QA ulang dengan hasil yang sama: `go vet` ✅, `go build` ✅, smoke test lokal **51 PASS, 0 FAIL** ✅.

Tahap 3 (smoke test pasca-deploy): `deploy/smoke-test.sh` sudah diperluas untuk redirect HTTPS/HSTS, semua route SPA (termasuk dashboard Admin/BOS), endpoint publik, logo/favicon, RBAC dengan method yang benar (termasuk penolakan `POST` ilegal), sanitasi error, Content-Type upload, serta alur struk unggah→tampil di Admin/BOS→hapus. Simulasi lokal memakai XAMPP + Vite + Go menghasilkan **51 PASS, 0 FAIL, 3 SKIP** (3 skip hanya pengecekan khusus HTTPS/Nginx dan opsi `RECEIPT_PATH`); akun dan file uji sudah dibersihkan. Verifikasi live di `https://kaliaja.coffe` belum bisa dijalankan dari mesin ini karena hostname belum ter-resolve (`curl: Could not resolve host: kaliaja.coffe`) — jalankan skrip dengan kredensial produksi setelah DNS/server siap.

## Catatan produksi

- Ganti `JWT_SECRET`, set `APP_ENV=production`, `COOKIE_SECURE=true`, `ALLOWED_ORIGIN=https://kaliaja.coffe`, dan `APP_URL=https://kaliaja.coffe`.
- Nginx harus memaksa HTTPS dan melayani `/uploads/` tanpa mengizinkan eksekusi script. Tipe gambar tetap `image/jpeg|png|gif|webp` agar `<img>` tampil; file selain itu memakai `application/octet-stream` + `X-Content-Type-Options: nosniff`.
- Jangan pernah mengirim error database/stack trace ke client — handler sudah memakai pesan generik.
- Smoke test production wajib mencakup upload/ganti struk dan memastikan file disajikan sebagai gambar/octet-stream, bukan HTML/script yang dieksekusi.
