# Frontend Vercel + Backend Render (gratis) — Opsi 1

Arsitektur yang disiapkan:

```
Browser
  │  https://kaliaja.coffe.vercel.app  (satu origin)
  ▼
Vercel (React statis) ──rewrite /api/*──► Render (API Golang, Dockerfile)
                      └─rewrite /uploads/*─►   │
                                               ├─► TiDB Cloud Serverless (MySQL)
                                               └─► Cloudinary (foto & struk)
```

## Kenapa perlu layanan tambahan?

Vercel hanya menyajikan file statis. Render gratis **bisa** menjalankan API Golang, tapi punya dua keterbatasan penting:

1. **Filesystem tidak persisten** — file di folder `uploads/` hilang saat service restart atau deploy. Karena itu upload dialihkan ke **Cloudinary** (ada paket gratis).
2. **Tidak menyediakan MySQL gratis** — pakai **TiDB Cloud Serverless** (kompatibel MySQL, ada tier gratis). Nama tier bisa berubah; pilih yang termurah/gratis di dashboard.

> Catatan jujur: Render gratis **sleep** setelah ±15 menit tidak ada request dan butuh ~30–60 detik untuk bangun (cold start). Untuk warung ini masih bisa dipakai, tapi kalau mau respons cepat 24/7 nanti upgrade ke paid (~$7/bulan) atau pindah ke Opsi 2 (VPS).

---

## Langkah 1 — Database (TiDB Cloud Serverless)

1. Daftar di TiDB Cloud → buat cluster **Serverless**, pilih region terdekat (Singapore).
2. Buat database:
   ```sql
   CREATE DATABASE IF NOT EXISTS kaliaja_coffe
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Buat user aplikasi (jangan pakai `root`):
   ```sql
   CREATE USER 'kaliaja_app'@'%' IDENTIFIED BY '<password-db-unik>';
   GRANT ALL PRIVILEGES ON kaliaja_coffe.* TO 'kaliaja_app'@'%';
   ```
4. Import skema lewat SQL Editor cluster:
   - `db/schema.sql`
   - `db/migrations/001_add_receipt_url.sql`
5. Di **Networking / IP Access Control**, izinkan koneksi dari semua IP (`0.0.0.0/0`) karena IP keluar Render bisa berubah. Ini perlu agar `DB_TLS=true` bisa terhubung.
6. Catat: **Host**, **Port** (biasanya `4000`), **User**, **Password**, **Database**.

> Bootstrap sesi & RBAC memakai tabel dari `db/schema.sql`. Jangan pakai AutoMigrate.

## Langkah 2 — Penyimpanan gambar (Cloudinary)

1. Daftar di Cloudinary → buka Dashboard.
2. Catat **Cloud Name**, **API Key**, **API Secret**.
3. Tidak perlu membuat folder manual — aplikasi membuat `kaliaja/products`, `kaliaja/activities`, `kaliaja/branding`, `kaliaja/receipts` otomatis.

## Langkah 3 — Backend (Render Blueprint)

1. Push repo ini ke GitHub/GitLab.
2. Render Dashboard → **New → Blueprint** → pilih repo. File `render.yaml` di root akan terbaca otomatis.
3. Isi environment variables bertanda `sync: false`:
   - `DB_HOST`, `DB_USER`, `DB_PASS` (dari Langkah 1)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (dari Langkah 2)
   - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — **wajib**, kalau kosong aplikasi berhenti saat start (token reset password tidak boleh dicatat ke log). Boleh pakai SMTP gratis seperti Brevo / Gmail App Password.
   - `SEED_ADMIN_PASSWORD`, `SEED_BOS_PASSWORD` — password awal admin & BOS.
   - `JWT_SECRET` sudah di-generate otomatis oleh Blueprint; jangan diganti dengan nilai contoh.
4. Deploy. Tunggu status **Live**. Health check: `https://kaliaja-api.onrender.com/health` → `{"status":"ok"}`.
5. Buat akun awal lewat **Render Shell** (tab Shell di service):
   ```bash
   ./server -seed
   ```
   Perintah ini aman diulang. Output harus mengatakan akun admin & BOS dibuat.

> `APP_URL` dan `ALLOWED_ORIGIN` sudah diisi `https://kaliaja.coffe.vercel.app` di `render.yaml`. Kalau URL Vercel kamu berbeda, ubah keduanya di dashboard Render lalu restart service.

## Langkah 4 — Frontend (Vercel)

1. Di folder `frontend/`:
   ```bash
   cp vercel.json.example vercel.json
   ```
2. Edit `vercel.json`, ganti **dua** `https://kaliaja-api.onrender.com` dengan URL Render-mu (tanpa trailing `/`).
3. Import project ke Vercel:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (terdeteksi otomatis)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Environment Variables:** `VITE_API_URL` **kosongkan** (frontend memakai path relatif `/api`).
4. Deploy. Pastikan `https://<project>.vercel.app/api/branding` mengembalikan JSON, bukan 404.

## Langkah 5 — Smoke test

```bash
BASE_URL=https://kaliaja.coffe.vercel.app \
SMOKE_ADMIN_EMAIL=admin@kaliaja.coffe SMOKE_ADMIN_PASSWORD='<password-admin>' \
SMOKE_BOS_EMAIL=bos@kaliaja.coffe SMOKE_BOS_PASSWORD='<password-bos>' \
bash deploy/smoke-test.sh
```

Skrip otomatis melewati pengecekan header HSTS/nosniff halaman karena header itu dikontrol Vercel. Endpoint API tetap diuji penuh (RBAC, upload struk, dll).

---

## Keterbatasan & mitigasi

| Masalah | Mitigasi |
|---|---|
| Cold start Render gratis (30–60 detik) | Ping `/health` tiap ~10 menit lewat cron gratis (crontab.org / cron-job.org), atau upgrade plan |
| Render gratis mati setelah 15 menit idle | Sama seperti di atas |
| Body upload Vercel proxy | `MAX_UPLOAD_MB=4` sudah diset di `render.yaml` |
| Cookie `SameSite=Strict` | Aman karena rewrite membuat browser melihat satu origin (Vercel) |
| X-Forwarded-For bisa dipalsukan | `TRUSTED_PROXIES=0.0.0.0/0` dipakai karena Render menimpa header; rate limiter tetap lapisan tambahan, bukan satu-satunya pertahanan |
| File lama ber-URL `/uploads/...` tidak ada di Render | Setelah pindah ke Cloudinary, upload ulang foto produk/kegiatan/logo lewat Admin/BOS |

## Pindah ke Opsi 2 nanti (VPS)

1. Siapkan VPS + domain sesuai `deploy/setup-server.sh` dengan `DEPLOY_MODE=full`.
2. Di `.env` VPS, set `STORAGE_DRIVER=local` (atau tetap `cloudinary` kalau ingin gambar tetap di Cloudinary — lebih aman saat migrasi).
3. Arahkan DNS `kaliaja.coffe` ke VPS.
4. Hapus `vercel.json` / matikan project Vercel. Tidak ada perubahan kode frontend yang diperlukan.
