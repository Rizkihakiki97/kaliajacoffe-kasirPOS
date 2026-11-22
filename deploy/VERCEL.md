# Frontend di Vercel + Backend di VPS

`kaliaja.coffe.vercel.app` adalah **domain bawaan Vercel**, bukan domain kustom `kaliaja.coffe` di PRD. Vercel hanya bisa menyajikan **frontend statis** (React hasil build). Aplikasi ini juga punya:

- REST API Golang yang harus berjalan 24/7,
- MySQL,
- folder `uploads/` untuk foto produk, foto kegiatan, logo, dan struk.

Ketiga hal itu **tidak bisa dijalankan oleh Vercel** dengan arsitektur saat ini. Karena itu tetap dibutuhkan **VPS** (atau platform container seperti Railway/Render/Fly.io) untuk backend + database + penyimpanan file.

## Rekomendasi alur

1. **VPS** menjalankan backend, MySQL, Nginx, dan `uploads/`. Bisa memakai `deploy/setup-server.sh`.
2. **Vercel** tetap menjadi frontend.
3. Frontend memanggil API lewat **rewrite** agar browser melihat satu origin (cookie `SameSite=Strict` tetap bekerja):
   - `/api/*` → `https://<API_HOST>/api/*`
   - `/uploads/*` → `https://<API_HOST>/uploads/*`

## Langkah

1. Siapkan VPS + backend dalam **mode API-only**. Misalnya API tersedia di `https://api.kaliaja.coffe`:
   ```bash
   export DOMAIN=api.kaliaja.coffe FRONTEND_URL=https://kaliaja.coffe.vercel.app
   export DEPLOY_MODE=api-only
   # + DB_PASS, JWT_SECRET, ADMIN_*, BOS_*, SMTP_*, LE_EMAIL
   bash deploy/setup-server.sh
   ```
   Skrip otomatis menulis `APP_URL` dan `ALLOWED_ORIGIN` = `FRONTEND_URL`, memasang Nginx tanpa halaman frontend, dan menjalankan smoke test dengan penyesuaian header Vercel.
2. Di folder `frontend/`:
   ```bash
   cp vercel.json.example vercel.json
   ```
   Edit `vercel.json`, ganti seluruh `https://API_HOST` dengan `https://api.kaliaja.coffe` (host API hasil langkah 1).
3. Deploy ke Vercel. Biarkan `VITE_API_URL` kosong agar frontend memakai path relatif `/api` dan `/uploads`.
4. Smoke test manual dari lokal:
   ```bash
   BASE_URL=https://kaliaja.coffe.vercel.app \
   SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... \
   SMOKE_BOS_EMAIL=... SMOKE_BOS_PASSWORD=... \
   bash deploy/smoke-test.sh
   ```

## Catatan penting

- Vercel membatasi ukuran body proxy. Jika upload 5 MB gagal, turunkan `MAX_UPLOAD_MB=4` di `backend/.env` VPS.
- Jika frontend dan backend beda origin **tanpa rewrite**, cookie `SameSite=Strict` tidak akan dikirim. Perlu `SameSite=None; Secure` + CORS + perlindungan CSRF tambahan. Rewrite adalah cara paling aman.
- Nama domain di `APP_URL`/`ALLOWED_ORIGIN` harus sama persis dengan URL Vercel yang dipakai (termasuk `www` bila ada).

## Alternatif lebih sederhana

Jika tidak ingin memelihara Vercel, arahkan domain kustom `kaliaja.coffe` langsung ke VPS dan host frontend dari `frontend/dist` lewat Nginx yang sudah disiapkan di `deploy/setup-server.sh`. Semua berjalan di satu tempat; tidak ada masalah cookie lintas-origin.
