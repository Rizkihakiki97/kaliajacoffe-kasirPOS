# Panduan Deploy Opsi 1 — Kaliaja.coffe

Dokumen ini adalah **panduan operasional Opsi 1** dengan nilai-nilai konkret untuk proyek ini. Untuk penjelasan umum, lihat `deploy/RENDER.md`. Untuk Opsi 2 (VPS), lihat `deploy/README.md`.

## 0. Status saat ini

| Item | Nilai / Status |
| :--- | :--- |
| Repo GitHub | `https://github.com/Rizkihakiki97/kaliajacoffe-kasirPOS.git` |
| Branch | `main` (sudah sinkron dengan GitHub) |
| URL Vercel | `https://kaliaja.coffe.vercel.app` |
| Service Render | `kaliaja-api` → diharapkan `https://kaliaja-api.onrender.com` |
| `APP_URL` / `ALLOWED_ORIGIN` | Sudah `https://kaliaja.coffe.vercel.app` di `render.yaml` — **jangan diubah** |
| `frontend/vercel.json` | Sudah dibuat & ter-push, rewrite `/api/*` dan `/uploads/*` ke `https://kaliaja-api.onrender.com` |
| `README.md` | Dipulihkan setelah sempat terhapus di GitHub |

> Kalau Render memberikan URL yang berbeda dari `https://kaliaja-api.onrender.com` (nama service sudah dipakai orang lain), ikuti Langkah 5 di bawah.

## 1. Arsitektur

```
Browser
  │  https://kaliaja.coffe.vercel.app  (satu origin → cookie SameSite=Strict aman)
  ▼
Vercel (React statis, Root Directory: frontend)
  ├─ rewrite /api/*      ──► Render: https://kaliaja-api.onrender.com
  └─ rewrite /uploads/*  ──► Render: https://kaliaja-api.onrender.com
                                  ├─► TiDB Cloud Serverless (MySQL, port 4000, TLS)
                                  └─► Cloudinary (foto produk, kegiatan, logo, struk)
```

Vercel hanya menyajikan file statis. Render gratis menjalankan API Golang, tetapi **disk-nya tidak persisten** dan **tidak menyediakan MySQL gratis**. Karena itu upload dialihkan ke Cloudinary dan database ke TiDB Cloud.

## 2. Akun yang disiapkan

- [x] GitHub (repo sudah ada)
- [ ] TiDB Cloud → cluster **Serverless**, region **Singapore**
- [ ] Cloudinary → paket gratis
- [ ] Render → akun gratis, deploy lewat **Blueprint**
- [ ] Vercel → akun Hobby gratis
- [ ] SMTP aktif: **Brevo** (gratis) atau **Gmail App Password** (perlu 2FA). `SMTP_HOST` **wajib** diisi; kalau kosong aplikasi berhenti saat start.

## 3. Langkah 1 — Database (TiDB Cloud Serverless)

1. Buat cluster **Serverless**, region **Singapore**.
2. Di **SQL Editor**, jalankan:
   ```sql
   CREATE DATABASE IF NOT EXISTS kaliaja_coffe
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

   CREATE USER 'kaliaja_app'@'%' IDENTIFIED BY '<password-db-unik>';
   GRANT ALL PRIVILEGES ON kaliaja_coffe.* TO 'kaliaja_app'@'%';
   ```
3. Import berurutan:
   - `db/schema.sql`
   - `db/migrations/001_add_receipt_url.sql`
4. **Networking / IP Access Control** → izinkan `0.0.0.0/0` (IP keluar Render bisa berubah).
5. Catat nilai ini untuk Render:

   | Env Render | Nilai |
   | :--- | :--- |
   | `DB_HOST` | Host cluster TiDB |
   | `DB_PORT` | `4000` |
   | `DB_USER` | `kaliaja_app` |
   | `DB_PASS` | Password unik yang dibuat di atas |
   | `DB_NAME` | `kaliaja_coffe` |
   | `DB_TLS` | `true` |

> Jangan pakai `root`. Jangan pakai AutoMigrate — schema bersumber dari `db/schema.sql` + migrasi.

## 4. Langkah 2 — Penyimpanan gambar (Cloudinary)

1. Buka Cloudinary Dashboard → catat:

   | Env Render | Nilai |
   | :--- | :--- |
   | `CLOUDINARY_CLOUD_NAME` | Cloud Name |
   | `CLOUDINARY_API_KEY` | API Key |
   | `CLOUDINARY_API_SECRET` | API Secret |
   | `CLOUDINARY_FOLDER` | `kaliaja` |

2. Tidak perlu buat folder manual. Aplikasi membuat `kaliaja/products`, `kaliaja/activities`, `kaliaja/branding`, dan `kaliaja/receipts` otomatis.

## 5. Langkah 3 — SMTP (wajib di produksi)

| Env Render | Contoh | Catatan |
| :--- | :--- | :--- |
| `SMTP_HOST` | `smtp-relay.brevo.com` | Wajib. Tanpa ini API gagal start. |
| `SMTP_PORT` | `587` | Default di `render.yaml` |
| `SMTP_USER` | user SMTP Brevo / email Gmail | |
| `SMTP_PASS` | API key Brevo / App Password Gmail | Jangan pakai password akun biasa |
| `SMTP_FROM` | `no-reply@kaliaja.coffe` | Jika provider menolak domain ini, ganti ke alamat yang terverifikasi di provider |

Token reset password dikirim lewat email. Di produksi token **tidak** dicetak ke log.

## 6. Langkah 4 — Backend (Render Blueprint)

1. Render Dashboard → **New → Blueprint** → pilih repo:
   ```
   https://github.com/Rizkihakiki97/kaliajacoffe-kasirPOS.git
   ```
   File `render.yaml` di root terbaca otomatis.

2. Isi environment variables di dashboard Render:

   | Key | Nilai | Sumber |
   | :--- | :--- | :--- |
   | `APP_ENV` | `production` | Otomatis dari `render.yaml` |
   | `APP_PORT` | `8080` | Otomatis |
   | `APP_URL` | `https://kaliaja.coffe.vercel.app` | Otomatis — jangan ubah |
   | `ALLOWED_ORIGIN` | `https://kaliaja.coffe.vercel.app` | Otomatis — jangan ubah |
   | `COOKIE_SECURE` | `true` | Otomatis |
   | `MAX_UPLOAD_MB` | `4` | Otomatis (batas proxy Vercel) |
   | `STORAGE_DRIVER` | `cloudinary` | Otomatis |
   | `TRUSTED_PROXIES` | `0.0.0.0/0,::/0` | Otomatis (proxy Render menimpa X-Forwarded-For) |
   | `JWT_SECRET` | generate otomatis | Jangan diganti dengan nilai contoh |
   | `DB_HOST` | host TiDB | Langkah 1 |
   | `DB_PORT` | `4000` | Otomatis |
   | `DB_USER` | `kaliaja_app` | Langkah 1 |
   | `DB_PASS` | password DB unik | Langkah 1 |
   | `DB_NAME` | `kaliaja_coffe` | Otomatis |
   | `DB_TLS` | `true` | Otomatis |
   | `CLOUDINARY_CLOUD_NAME` | Cloud Name | Langkah 2 |
   | `CLOUDINARY_API_KEY` | API Key | Langkah 2 |
   | `CLOUDINARY_API_SECRET` | API Secret | Langkah 2 |
   | `CLOUDINARY_FOLDER` | `kaliaja` | Otomatis |
   | `SMTP_HOST` | host SMTP | Langkah 3 |
   | `SMTP_PORT` | `587` | Otomatis |
   | `SMTP_USER` | user SMTP | Langkah 3 |
   | `SMTP_PASS` | password/API key SMTP | Langkah 3 |
   | `SMTP_FROM` | `no-reply@kaliaja.coffe` | Otomatis, bisa disesuaikan |
   | `SEED_ADMIN_EMAIL` | `admin@kaliaja.coffe` | Otomatis |
   | `SEED_ADMIN_PASSWORD` | password admin baru | **Wajib diisi unik** |
   | `SEED_BOS_EMAIL` | `bos@kaliaja.coffe` | Otomatis |
   | `SEED_BOS_PASSWORD` | password BOS baru | **Wajib diisi unik** |

3. Deploy → tunggu status **Live**.
4. Cek health check:
   ```
   https://kaliaja-api.onrender.com/health
   ```
   Harus balas `{"status":"ok"}`.
5. Buka tab **Shell** di service Render, jalankan:
   ```bash
   ./server -seed
   ```
   Aman diulang. Output harus menyebut akun admin & BOS dibuat.
6. **Catat URL Render asli** yang diberikan (bisa bukan `kaliaja-api.onrender.com`).

## 7. Langkah 5 — Samakan `vercel.json` dengan URL Render

Lewati langkah ini kalau URL Render persis `https://kaliaja-api.onrender.com`.

Edit `frontend/vercel.json`, ganti **dua** `destination` dengan URL Render asli (tanpa trailing `/`):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://<URL-RENDER-ASLI>/api/:path*"
    },
    {
      "source": "/uploads/:path*",
      "destination": "https://<URL-RENDER-ASLI>/uploads/:path*"
    },
    {
      "source": "/((?!api/|uploads/).*)",
      "destination": "/index.html"
    }
  ]
}
```

Lalu dari lokal:

```powershell
cd C:\xampp\htdocs\kali-aja-coffe
git add frontend/vercel.json
git commit -m "Update Render API URL"
git push origin main
```

Vercel akan otomatis redeploy setelah push.

## 8. Langkah 6 — Frontend (Vercel)

1. Vercel → **Add New → Project** → import `kaliajacoffe-kasirPOS`.
2. Pengaturan:

   | Pengaturan | Nilai |
   | :--- | :--- |
   | Root Directory | `frontend` |
   | Framework Preset | Vite (terdeteksi otomatis) |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | `VITE_API_URL` | **Kosongkan** |

3. Deploy. Pastikan `VITE_API_URL` kosong agar frontend memakai path relatif `/api` dan `/uploads` (cookie tetap satu-origin lewat rewrite).
4. Verifikasi cepat:
   ```
   https://kaliaja.coffe.vercel.app/api/branding
   ```
   Harus mengembalikan JSON, bukan 404/HTML.

## 9. Langkah 7 — Smoke test

Lewat **Git Bash** di folder proyek:

```bash
BASE_URL=https://kaliaja.coffe.vercel.app \
SMOKE_ADMIN_EMAIL=admin@kaliaja.coffe SMOKE_ADMIN_PASSWORD='<password-admin>' \
SMOKE_BOS_EMAIL=bos@kaliaja.coffe SMOKE_BOS_PASSWORD='<password-bos>' \
bash deploy/smoke-test.sh
```

Atau lewat **PowerShell**:

```powershell
$env:BASE_URL="https://kaliaja.coffe.vercel.app"
$env:SMOKE_ADMIN_EMAIL="admin@kaliaja.coffe"
$env:SMOKE_ADMIN_PASSWORD="<password-admin>"
$env:SMOKE_BOS_EMAIL="bos@kaliaja.coffe"
$env:SMOKE_BOS_PASSWORD="<password-bos>"
bash deploy/smoke-test.sh
```

Skrip melewati pengecekan header HSTS/nosniff khusus halaman karena header itu dikontrol Vercel. Endpoint API tetap diuji penuh (RBAC, upload struk, dll).

> Rate limiter auth memberi 5 token per menit per IP. Kalau dapat `429`, tunggu ±12 detik lalu ulang.

## 10. Verifikasi manual singkat

- [ ] Landing page, galeri kegiatan, dan favicon tampil
- [ ] Menu Coffee / Non-Coffee / Snack beserta foto tampil
- [ ] Register → login → order → struk cetak (`window.print()`)
- [ ] Login Admin → CRUD produk & kegiatan, POS, daftar transaksi, upload/ganti/hapus struk
- [ ] Login BOS → rekap transaksi, stok, upload logo & favicon
- [ ] Foto hasil upload tersimpan di Cloudinary (bukan `/uploads/` lokal)

## 11. Operasional pasca-deploy

| Topik | Tindakan |
| :--- | :--- |
| Cold start Render gratis | Service sleep setelah ±15 menit idle, bangun 30–60 detik. Ping `/health` tiap ~10 menit lewat cron gratis (cron-job.org), atau upgrade plan ~$7/bulan. |
| Foto lama | URL `/uploads/...` dari lokal tidak ikut ke Cloudinary. Upload ulang foto produk, kegiatan, logo, dan favicon lewat Admin/BOS. |
| Backup DB | Manfaatkan fitur backup di dashboard TiDB Cloud sesuai tier yang dipakai. |
| Domain kustom | Tambahkan `kaliaja.coffe` di Vercel → **Settings → Domains**, lalu samakan `APP_URL` & `ALLOWED_ORIGIN` di Render dengan domain tersebut dan restart service. Tidak perlu ubah kode frontend. |
| Update kode | `git push origin main` → Render & Vercel otomatis redeploy. |

## 12. Troubleshooting

| Gejala | Penyebab & solusi |
| :--- | :--- |
| `/api/branding` 404 di Vercel | `vercel.json` belum ter-push / Root Directory bukan `frontend` / URL Render di rewrite salah. |
| Login sukses tapi langsung logout / loop redirect | `APP_URL` atau `ALLOWED_ORIGIN` tidak sama persis dengan URL Vercel. Perbaiki di Render lalu restart. |
| `429` saat login | Rate limiter 5 request/menit per IP. Tunggu ±12 detik. |
| API lama merespons pertama kali | Cold start Render gratis. Normal; bisa diping rutin. |
| Gagal koneksi database | Cek `DB_TLS=true`, IP access `0.0.0.0/0` di TiDB, serta `DB_HOST`/`DB_PORT=4000`. |
| Upload gagal / 413 | `MAX_UPLOAD_MB=4` sudah diset karena batas body proxy Vercel. UI masih menampilkan batas 5 MB di deskripsi lama. |
| Gambar tidak tampil setelah deploy | Upload ulang — file lama ber-URL `/uploads/...` tidak pindah ke Cloudinary. |
| API gagal start | `SMTP_HOST`, `JWT_SECRET`, atau kredensial Cloudinary kosong. Cek log Render. |
| Struk tidak muncul di rekap BOS | Pastikan upload struk memakai endpoint Admin dan `receipt_url` tersimpan, lalu refresh halaman BOS. |

## 13. Catatan keamanan

- Jangan pernah commit `backend/.env`. File ini sudah ter-ignore di `backend/.gitignore`.
- Gunakan password unik untuk DB, SMTP, admin, dan BOS. Jangan pakai nilai dari `.env.example`.
- `JWT_SECRET` di-generate otomatis oleh Blueprint Render — jangan diganti dengan contoh.
- Cookie `HttpOnly; Secure; SameSite=Strict` aman karena rewrite membuat browser melihat satu origin (Vercel).
- Error database/stack trace tidak dikirim ke klien; handler sudah memakai pesan generik.

## 14. Pengembangan lokal tetap seperti sebelumnya

`vercel.json` hanya dipakai Vercel. Untuk development di XAMPP:

```powershell
cd C:\xampp\htdocs\kali-aja-coffe\frontend
npm run dev
```

Vite tetap meneruskan `/api` dan `/uploads` ke `http://localhost:8080` lewat `vite.config.js`, jadi `VITE_API_URL` tetap kosong.
