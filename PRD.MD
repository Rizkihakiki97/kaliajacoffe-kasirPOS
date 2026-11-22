# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Aplikasi Kasir (POS) & Pemesanan Kafe — **Kaliaja.coffe**

| Informasi Dokumen | Detail |
| :--- | :--- |
| **Nama Produk** | Kaliaja.coffe (POS & Ordering System) |
| **Domain / Hosting** | `https://kaliaja.coffe` |
| **Versi Dokumen** | 1.0 (Final — Tanpa Modul Restock/Penyesuaian Stok Manual) |
| **Tanggal Pembuatan** | 20 November 2026 |
| **Tech Stack** | Golang (REST API), ReactJS (Frontend), MySQL (Database) |
| **Referensi Template UI** | ThemeWagon (`https://themewagon.com/`) |

---

## 1. Ringkasan Produk & Tujuan Bisnis

**Kaliaja.coffe** adalah aplikasi berbasis web yang menggabungkan sistem kasir (*Point of Sale* / POS), katalog & pemesanan menu kafe (*Coffee*, *Non-Coffee*, dan *Snack*), serta manajemen galeri kegiatan dalam satu platform terintegrasi.

### Tujuan Utama Sistem
1. **Kemudahan Pemesanan Pelanggan:** Mempermudah pelanggan melihat profil **Kaliaja.coffe**, menelusuri menu *Coffee*, *Non-Coffee*, dan *Snack* beserta fotonya, serta melakukan pemesanan secara terstruktur.
2. **Efisiensi Operasional Admin:** Membantu **Admin** mengelola katalog menu beserta foto produk, mengelola galeri foto kegiatan (CRUD), melayani transaksi kasir maupun pemesanan pelanggan, serta **mengunggah struk bukti pembayaran** untuk setiap transaksi.
3. **Transparansi & Kontrol untuk BOS:** Memberikan visibilitas menyeluruh kepada **BOS** terkait keseluruhan transaksi masuk dan keluar, sisa stok barang, serta pengaturan identitas visual (*Logo* dan *Favicon*).
4. **Keamanan & Stabilitas Produksi:** Menjamin keamanan sistem dari peretasan, kebocoran data, serta bug/error melalui proses pengujian menyeluruh sebelum *deployment* produksi ke `kaliaja.coffe`.

---

## 2. Tech Stack & Arsitektur Sistem

### 2.1 Teknologi yang Digunakan
* **Backend (Golang):** RESTful API menggunakan framework ringan dan cepat (seperti Gin atau Fiber) serta ORM GORM untuk koneksi ke database MySQL.
* **Frontend (ReactJS):** Antarmuka web modern berbasis komponen modular yang mengadaptasi template dari ThemeWagon untuk *Landing Page* dan *Dashboard*.
* **Database (MySQL):** Penyimpanan data relasional untuk akun pengguna, produk, stok, transaksi kasir, pemesanan pelanggan, galeri kegiatan, dan pengaturan brand.
* **Referensi Template UI (ThemeWagon):** Menggunakan template bertema kafe/kuliner untuk *landing page* & halaman pemesanan, serta template admin untuk panel *Admin* dan *BOS* dari `https://themewagon.com/`.
* **Hosting & Domain:** Di-deploy pada server produksi untuk domain `https://kaliaja.coffe` dengan konfigurasi *reverse proxy* Nginx dan sertifikat SSL/HTTPS.

### 2.2 Arsitektur Alur Data
* **Komunikasi Client-Server:** Frontend ReactJS berkomunikasi dengan Backend Golang melalui **REST API** berformat JSON.
* **Penyimpanan Media & Gambar:** File gambar (foto produk *Coffee*, *Non-Coffee*, *Snack*, foto kegiatan, logo, dan favicon) disimpan di direktori penyimpanan terkelola dengan validasi ketat dan disajikan melalui URL yang aman.
* **Mekanisme Stok Otomatis:** Stok produk dikelola secara langsung pada data produk dan berkurang secara otomatis saat terjadi transaksi pembelian dari customer maupun transaksi kasir.

---

## 3. Peran Pengguna & Hak Akses (RBAC)

### 3.1 Pengguna Baru / Customer
* **Autentikasi Akun:** Melakukan **Registrasi** akun baru, **Login**, dan **Reset Password**.
* **Akses Halaman Publik:** Mengakses *Landing Page* **Kaliaja.coffe** lengkap dengan logo brand dan *favicon*, serta melihat galeri foto kegiatan kafe.
* **Katalog & Pemesanan:** Melihat daftar menu **Coffee**, **Non-Coffee**, dan **Snack** beserta foto, harga, dan ketersediaan stok, lalu melakukan transaksi pembelian.
* **Cetak Bukti Pesanan:** Setelah pesanan berhasil dibuat, customer melihat struk berisi nomor invoice, waktu, rincian item, dan total, lalu dapat mencetaknya langsung lewat tombol **Cetak Struk** (`window.print()`). Halaman cetak hanya menampilkan area struk tanpa tombol atau navigasi aplikasi.

### 3.2 Admin
* **Autentikasi Admin:** Login menggunakan akun ber-role `admin`.
* **Manajemen Produk & Foto:** Mengelola menu **Coffee**, **Non-Coffee**, dan **Snack** (tambah, ubah, hapus, upload foto produk, dan pengaturan jumlah stok produk).
* **Manajemen Foto Kegiatan (CRUD):** Mengelola foto kegiatan kafe dengan operasi *Create*, *Read*, *Update/Edit*, dan *Delete* secara penuh.
* **Operasional Kasir (POS):** Menggunakan fitur kasir untuk memproses transaksi pembelian kepada customer serta memproses pesanan masuk dari customer.
* **Daftar Transaksi:** Melihat seluruh transaksi kasir dan pesanan customer dari database (dengan filter sumber/status dan pencarian) sebelum mengelola struknya.
* **Upload Struk Transaksi:** Mengunggah, mengganti, dan menghapus **struk/bukti pembayaran** untuk transaksi kasir (POS) maupun pesanan customer. Struk bersifat opsional dan diunggah setelah transaksi dibuat.

### 3.3 BOS
* **Autentikasi BOS:** Login menggunakan akun ber-role `bos`.
* **Monitoring Transaksi Menyeluruh:** Melihat **keseluruhan transaksi yang masuk** dan **transaksi yang keluar** secara lengkap.
* **Monitoring Stok Barang:** Melihat ketersediaan **stok barang** terkini pada seluruh produk.
* **Pengaturan Logo & Favicon:** Mengelola/mengunggah **logo utama** dan **favicon** agar tampil konsisten di seluruh dashboard admin/bos, landing page, dan tab browser.

---

## 4. Spesifikasi Fitur Fungsional

### 4.1 Autentikasi Pengguna (Registrasi, Login, Reset Password)
* **Registrasi Pengguna Baru:** Formulir pendaftaran akun baru dengan validasi input (nama, email unik, password kuat) serta enkripsi password (*password hashing*).
* **Login Multi-Role:** Autentikasi pengguna berdasarkan email dan password dengan penerbitan token sesi/JWT yang aman serta pengalihan halaman sesuai role (*Customer*, *Admin*, *BOS*).
* **Reset Password:** Alur pemulihan kata sandi menggunakan token verifikasi unik yang memiliki masa berlaku singkat dan otomatis hangus setelah digunakan sekali.

### 4.2 Branding Logo & Favicon Dinamis
* **Konsistensi Tampilan:** Setiap halaman **Dashboard Admin/BOS** dan **Landing Page** menampilkan logo brand **Kaliaja.coffe** yang sama.
* **Favicon Browser:** Ikon tab browser (*favicon*) menggunakan gambar logo yang sama sehingga identitas visual seragam di seluruh halaman.
* **Pembaruan Dinamis:** Ketika file gambar logo diunggah/diperbarui, tampilan logo di navbar/sidebar maupun *favicon* di browser otomatis menyesuaikan.

### 4.3 Manajemen Menu & Upload Foto (Coffee, Non-Coffee, Snack)
* **Tiga Kategori Utama:** Pengelompokan menu ke dalam kategori **Coffee**, **Non-Coffee**, dan **Snack**.
* **Upload Foto & Data Produk:** Admin dapat menambah, mengedit, dan menghapus item menu beserta **upload foto produk**, harga, deskripsi, dan jumlah stok.

### 4.4 Fitur Upload Foto Kegiatan (Sistem CRUD)
* **Create (Tambah):** Upload foto kegiatan baru beserta judul, tanggal, dan deskripsi kegiatan.
* **Read (Lihat):** Menampilkan daftar foto kegiatan di dashboard manajemen maupun galeri publik pada landing page.
* **Update (Edit):** Mengubah informasi kegiatan atau mengganti file foto kegiatan yang sudah ada.
* **Delete (Hapus):** Menghapus data dan file foto kegiatan yang tidak lagi diperlukan.

### 4.5 Transaksi Kasir (POS) & Transaksi Pembelian Customer
* **Transaksi Kasir oleh Admin:** Admin memilih item menu (*Coffee*, *Non-Coffee*, *Snack*), sistem menghitung total pembayaran otomatis, dan menyimpan transaksi untuk customer.
* **Transaksi Pembelian oleh Customer:** Customer memilih menu yang tersedia pada halaman pemesanan dan mengajukan transaksi pembelian.
* **Pengurangan Stok Otomatis:** Setiap transaksi pembelian yang berhasil (baik via kasir maupun customer) otomatis mengurangi stok produk terkait dan menolak transaksi jika stok tidak mencukupi.
* **Cetak Struk Pesanan (Customer):** Halaman sukses pesanan menampilkan struk yang dapat dicetak dengan `window.print()`. Cetakan hanya berisi kop **Kaliaja.coffe**, nomor invoice, waktu, status, rincian item, dan total. Fitur ini tidak menggantikan unggah struk admin.
* **Upload Struk (Bukti Pembayaran):** Setelah transaksi dibuat, **Admin** dapat mengunggah **struk** untuk transaksi kasir maupun pesanan customer, serta mengganti atau menghapusnya. Struk bersifat opsional, hanya berupa gambar (JPG/PNG/GIF/WEBP, maksimal 5 MB), dan tautan `receipt_url` ikut dikembalikan pada response transaksi serta rekap BOS. File lama otomatis dihapus saat struk diganti.

> **Catatan Alur Stok Barang:**
> Sistem tidak menggunakan modul terpisah untuk input barang masuk (*restock*) maupun penyesuaian stok keluar manual. Jumlah stok dikelola langsung pada data produk oleh Admin dan berkurang otomatis setiap kali terjadi transaksi pembelian.

### 4.6 Dashboard Monitoring BOS
* **Laporan Transaksi Masuk & Keluar:** Menampilkan rekapitulasi serta rincian seluruh transaksi yang masuk dan transaksi yang keluar.
* **Pemantauan Sisa Stok:** Menampilkan daftar stok barang terkini untuk seluruh kategori menu *Coffee*, *Non-Coffee*, dan *Snack*.

---

## 5. Rancangan Struktur Tabel Database (MySQL)

Berikut adalah struktur tabel relasional MySQL yang dirancang untuk mendukung seluruh kebutuhan fungsional dan keamanan aplikasi:

| Nama Tabel | Kolom Utama | Keterangan Fungsi |
| :--- | :--- | :--- |
| `users` | `id`, `name`, `email`, `password_hash`, `role`, `reset_token`, `reset_token_expires_at`, `created_at`, `updated_at` | Menyimpan data akun `customer`, `admin`, dan `bos` beserta token reset password. |
| `branding_settings` | `id`, `brand_name`, `logo_url`, `favicon_url`, `updated_by`, `updated_at` | Menyimpan konfigurasi logo utama dan favicon untuk seluruh tampilan. |
| `categories` | `id`, `name`, `slug`, `created_at` | Kategori utama menu: `Coffee`, `Non-Coffee`, dan `Snack`. |
| `products` | `id`, `category_id`, `name`, `description`, `price`, `stock`, `image_url`, `created_at`, `updated_at` | Data produk menu, harga, jumlah stok, dan path foto produk. |
| `activities` | `id`, `title`, `description`, `image_url`, `event_date`, `created_by`, `created_at`, `updated_at` | Data dan foto kegiatan kafe untuk modul CRUD kegiatan. |
| `transactions` | `id`, `invoice_code`, `source`, `cashier_id`, `customer_id`, `flow_type`, `total_amount`, `status`, `receipt_url`, `created_at`, `updated_at` | Mencatat seluruh transaksi masuk dan keluar (dari kasir POS maupun customer) beserta **path struk/bukti pembayaran** pada kolom `receipt_url` (nullable). |
| `transaction_items` | `id`, `transaction_id`, `product_id`, `quantity`, `price`, `subtotal` | Detail item produk, kuantitas, dan subtotal pada setiap transaksi. |

> **Catatan Struk:** Kolom `receipt_url` pada `transactions` menyimpan URL relatif file struk di direktori `uploads/receipts/`. Kolom ini **opsional** (`NULL`/kosong sebelum struk diunggah) dan disertakan dalam `db/schema.sql` serta migrasi `db/migrations/001_add_receipt_url.sql`.

---

## 6. Spesifikasi Endpoint REST API (Golang)

Berikut pemetaan dasar endpoint REST API untuk komunikasi antara Frontend ReactJS dan Backend Golang:

| Modul | Method & Endpoint | Akses Role | Keterangan |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST /api/auth/register` | Publik | Registrasi akun customer baru |
| **Auth** | `POST /api/auth/login` | Publik | Login pengguna (`customer`, `admin`, `bos`) |
| **Auth** | `POST /api/auth/forgot-password` | Publik | Request token reset password |
| **Auth** | `POST /api/auth/reset-password` | Publik | Konfirmasi password baru menggunakan token |
| **Branding** | `GET /api/branding` | Publik | Mengambil URL logo & favicon aktif |
| **Branding** | `PUT /api/branding` | `bos` | Upload & perbarui logo utama serta favicon |
| **Kategori** | `GET /api/categories` | Publik | Mengambil daftar kategori (`id`, `name`, `slug`) untuk filter menu & form produk |
| **Produk** | `GET /api/products` | Publik | Menampilkan daftar menu (`Coffee`, `Non-Coffee`, `Snack`) |
| **Produk** | `POST /api/products` | `admin` | Tambah menu baru beserta upload foto produk & stok |
| **Produk** | `PUT /api/products/:id` | `admin` | Edit data produk, stok, atau ganti foto produk |
| **Produk** | `DELETE /api/products/:id` | `admin` | Hapus item produk |
| **Kegiatan** | `GET /api/activities` | Publik | Menampilkan galeri foto kegiatan kafe |
| **Kegiatan** | `POST /api/activities` | `admin` | Upload foto kegiatan baru (Create) |
| **Kegiatan** | `PUT /api/activities/:id` | `admin` | Edit keterangan atau foto kegiatan (Update) |
| **Kegiatan** | `DELETE /api/activities/:id` | `admin` | Hapus foto kegiatan (Delete) |
| **Transaksi** | `GET /api/transactions` | `admin` | Daftar seluruh transaksi untuk keperluan upload struk; mendukung filter `source`, `status`, `flow_type`, `start`, `end`, dan pencarian `q` (ID/invoice). Response memuat ringkasan & detail item |
| **Transaksi** | `POST /api/transactions/pos` | `admin` | Input transaksi kasir (POS) oleh Admin (response menyertakan `receipt_url`) |
| **Transaksi** | `POST /api/transactions/order` | `customer` | Input transaksi pembelian dari Customer (response menyertakan `receipt_url`) |
| **Transaksi** | `POST /api/transactions/:id/receipt` | `admin` | Unggah/ganti struk bukti pembayaran (multipart `receipt`) untuk transaksi POS maupun order |
| **Transaksi** | `DELETE /api/transactions/:id/receipt` | `admin` | Hapus struk pada transaksi terkait |
| **Monitoring** | `GET /api/bos/transactions` | `bos` | Melihat keseluruhan transaksi masuk & keluar beserta `receipt_url` |
| **Monitoring** | `GET /api/bos/stocks` | `bos` | Melihat sisa stok seluruh produk |

---

## 7. Standar Keamanan Aplikasi (Anti-Hack & Anti-Kebocoran Data)

Untuk melindungi data transaksi, kredensial pengguna, dan server produksi dari peretasan maupun kebocoran data, aplikasi wajib menerapkan lapisan keamanan berikut:

1. **Pencegahan SQL Injection:** Seluruh query database di backend Golang wajib menggunakan *parameterized queries* / *prepared statements* melalui GORM. Dilarang keras menggabungkan string input pengguna secara langsung ke dalam query SQL.
2. **Keamanan Password & Sesi Autentikasi:** Password pengguna wajib di-hash menggunakan **Bcrypt** (`cost >= 12`). Token sesi/JWT disimpan menggunakan cookie `HttpOnly`, `Secure`, dan `SameSite=Strict` untuk mencegah pencurian sesi melalui serangan XSS.
3. **Kontrol Akses Ketat (RBAC & Anti-IDOR):** Setiap endpoint REST API wajib memverifikasi token autentikasi dan `role` pengguna di sisi server. Customer tidak dapat mengakses endpoint admin/bos, dan Admin tidak dapat mengakses data khusus BOS.
4. **Validasi Upload File yang Ketat:** Backend Golang memeriksa *MIME type* / *magic bytes* asli dari file gambar (bukan sekadar ekstensi nama file), membatasi ukuran file maksimal, mengganti nama file menjadi UUID acak, dan menonaktifkan eksekusi script pada folder upload.
5. **Proteksi Brute Force & Rate Limiting:** Menerapkan pembatasan jumlah percobaan request (*rate limiter*) pada endpoint login, registrasi, lupa password, dan reset password untuk mencegah serangan *brute force*. Endpoint `GET /auth/me` tidak dikenakan limiter agar sesi valid tidak terkena 429 saat halaman dimuat.
6. **Pembatasan CORS & Sanitasi Error:** Konfigurasi CORS hanya mengizinkan origin resmi `https://kaliaja.coffe`. Pesan error internal database maupun *stack trace* tidak pernah dikirimkan ke frontend.
7. **Enkripsi Lalu Lintas Data (HTTPS/TLS):** Seluruh komunikasi data antara browser pengguna dan server wajib terenkripsi menggunakan protokol HTTPS.

---

## 8. Alur Quality Assurance, Testing, & Deployment (`kaliaja.coffe`)

Sebelum aplikasi dirilis ke publik pada domain `kaliaja.coffe`, tim pengembangan wajib menjalankan tahapan pengujian dan deployment berikut secara berurutan:

### Tahap 1: Pengecekan Bug, Error, & Kelemahan Keamanan (Pre-Deploy)
* **Pengujian Fungsional & Alur Pengguna:** Menguji seluruh fitur registrasi, login, reset password, CRUD menu + upload foto (*Coffee*, *Non-Coffee*, *Snack*), CRUD foto kegiatan, transaksi kasir, transaksi customer, pengurangan stok otomatis, **unggah/ganti/hapus struk bukti pembayaran untuk transaksi POS maupun order**, sinkronisasi logo & favicon, serta laporan BOS.
* **Audit Kerentanan Keamanan:** Melakukan pemindaian dependensi (`govulncheck` pada Golang dan `npm audit` pada ReactJS) serta pengujian celah keamanan (XSS, CSRF, SQL Injection, akses ilegal antar-role, dan bypass upload file, **termasuk upload struk**: validasi MIME/*magic bytes*, batas ukuran 5 MB, UUID nama file, dan pencegahan eksekusi script pada direktori `uploads/`).
* **Perbaikan Wajib Sebelum Rilis:** Setiap bug, error, maupun celah keamanan yang ditemukan pada tahap pengujian wajib diperbaiki dan diverifikasi ulang hingga dinyatakan bersih sebelum proses deployment dimulai.

### Tahap 2: Deployment ke Hosting Produksi (`kaliaja.coffe`)
* **Konfigurasi Server & Domain:** Menyiapkan server produksi Linux, mengarahkan DNS domain `kaliaja.coffe`, dan memasang sertifikat SSL/HTTPS aktif.
* **Deploy Backend, Frontend, & Database:** Menjalankan service binary Golang REST API di background (Systemd), menyajikan hasil build produksi ReactJS melalui Nginx *reverse proxy*, serta mengaktifkan database MySQL produksi dengan autentikasi ketat.
* **Direktori Upload Struk:** Menyajikan `uploads/receipts/` sebagai file statis dengan tipe `application/octet-stream`, header `X-Content-Type-Options: nosniff`, dan tanpa izin eksekusi script.
* **Pencadangan Otomatis (Backup):** Menjadwalkan backup database MySQL secara berkala untuk mencegah kehilangan data.

### Tahap 3: Verifikasi Pasca-Deployment (Post-Deploy Smoke Test)
* **Pengujian Live di `https://kaliaja.coffe`:** Memastikan seluruh halaman landing page, dashboard admin, dashboard BOS, logo, favicon, proses upload gambar, dan alur transaksi berjalan lancar tanpa error serta terlindungi dengan aman. Khusus struk, verifikasi alur unggah/ganti/hapus, tautan `receipt_url` muncul pada transaksi & rekap BOS, dan file disajikan sebagai `application/octet-stream` (bukan dieksekusi).