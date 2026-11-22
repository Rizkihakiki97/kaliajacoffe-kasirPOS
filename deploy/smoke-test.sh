#!/usr/bin/env bash
# Smoke test pasca-deploy (Tahap 3 PRD) untuk https://kaliaja.coffe
#
# Penggunaan:
#   BASE_URL=https://kaliaja.coffe bash deploy/smoke-test.sh
#
# Variabel opsional:
#   HOST_HEADER=kaliaja.coffe          host untuk pengecekan redirect HTTP -> HTTPS
#   TIMEOUT=15                         timeout curl per permintaan (detik)
#   SMOKE_ADMIN_EMAIL / _PASSWORD      kredensial admin untuk uji RBAC & struk
#   SMOKE_BOS_EMAIL / _PASSWORD        kredensial BOS untuk uji rekap & stok
#   SMOKE_CUSTOMER_EMAIL / _PASSWORD   kredensial customer untuk uji RBAC
#   SMOKE_TRANSACTION_ID               ID transaksi untuk uji upload struk
#   SMOKE_RECEIPT_FILE                 file gambar struk untuk uji upload/hapus
#
# Credential tidak pernah ditampilkan; hanya cookie jar sementara yang dipakai.
set -uo pipefail

BASE_URL="${BASE_URL:-https://kaliaja.coffe}"
BASE_URL="${BASE_URL%/}"
HOST_HEADER="${HOST_HEADER:-kaliaja.coffe}"
TIMEOUT="${TIMEOUT:-15}"
ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD:-}"
BOS_EMAIL="${SMOKE_BOS_EMAIL:-}"
BOS_PASSWORD="${SMOKE_BOS_PASSWORD:-}"
CUSTOMER_EMAIL="${SMOKE_CUSTOMER_EMAIL:-}"
CUSTOMER_PASSWORD="${SMOKE_CUSTOMER_PASSWORD:-}"
RECEIPT_PATH="${RECEIPT_PATH:-}"
SMOKE_TRANSACTION_ID="${SMOKE_TRANSACTION_ID:-}"
SMOKE_RECEIPT_FILE="${SMOKE_RECEIPT_FILE:-}"
SKIP_PAGE_HEADER_CHECKS="${SKIP_PAGE_HEADER_CHECKS:-0}" # Vercel mengontrol header halaman

TMP_DIR="$(mktemp -d)"
# File uji memakai path relatif agar bisa dibaca curl native di Windows Git Bash
# maupun curl di Linux.
FAKE_FILE="./.smoke-fake-$$.php"
trap 'rm -rf "$TMP_DIR" "$FAKE_FILE"' EXIT
PASS=0
FAIL=0
SKIP=0
if [[ "$BASE_URL" == https://* ]]; then REQUIRE_NOSNIFF=1; else REQUIRE_NOSNIFF=0; fi
STATIC_NOSNIFF="${STATIC_NOSNIFF:-$REQUIRE_NOSNIFF}" # favicon/logo mungkin dilayani Vercel

pass() { PASS=$((PASS + 1)); echo "PASS  $1"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL  $1"; }
skip() { SKIP=$((SKIP + 1)); echo "SKIP  $1"; }

request() {
  # request <url> [curl args...] -> menulis body ke $TMP_DIR/body, stdout = status code
  local url="$1"; shift
  local code
  code="$(curl -sS -o "$TMP_DIR/body" -w '%{http_code}' --max-time "$TIMEOUT" "$@" "$url" || true)"
  [[ "$code" =~ ^[0-9]{3}$ ]] || code=000
  printf '%s' "$code"
}

check_status() {
  local label="$1" url="$2" expected="$3" code
  code="$(request "$url")"
  local want
  for want in $expected; do
    if [[ "$code" == "$want" ]]; then pass "$label ($code)"; return 0; fi
  done
  fail "$label —harus $expected, dapat $code"
  return 1
}

check_body() {
  local label="$1" url="$2" needle="$3" code
  code="$(request "$url")"
  if [[ "$code" == 200 ]] && grep -qF "$needle" "$TMP_DIR/body"; then
    pass "$label"
  else
    fail "$label —status $code, tidak menemukan '$needle'"
  fi
}

check_no_leak() {
  local label="$1" url="$2" code
  code="$(request "$url")"
  if grep -qiE 'sql|gorm|stack trace|panic|password_hash' "$TMP_DIR/body"; then
    fail "$label —response mengandung detail internal"
  else
    pass "$label (status $code, pesan generik)"
  fi
}

check_json() {
  local label="$1" url="$2" jar="$3" needle="$4" code
  if [[ -n "$jar" ]]; then
    code="$(request "$url" -b "$jar")"
  else
    code="$(request "$url")"
  fi
  if [[ "$code" == 200 ]] && grep -qF "$needle" "$TMP_DIR/body"; then
    pass "$label"
  else
    fail "$label —status $code, tidak menemukan '$needle'"
  fi
}

check_forbidden() {
  local label="$1" url="$2" jar="$3" code
  shift 3
  if [[ $# -gt 0 ]]; then
    code="$(request "$url" -b "$jar" "$@")"
  else
    code="$(request "$url" -b "$jar")"
  fi
  if [[ "$code" == 403 ]]; then pass "$label (403)"; else fail "$label —harus 403, dapat $code"; fi
}

login() {
  local label="$1" email="$2" password="$3" jar="$4" code
  if [[ -z "$email" || -z "$password" ]]; then
    skip "$label —kredensial tidak diset"
    return 1
  fi
  code="$(curl -sS -o "$TMP_DIR/login" -w '%{http_code}' --max-time "$TIMEOUT" \
    -c "$jar" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    "$BASE_URL/api/auth/login" || true)"
  if [[ "$code" == 200 ]] && grep -q '"success":true' "$TMP_DIR/login"; then
    pass "$label"
    return 0
  fi
  if [[ "$code" == 429 ]]; then
    skip "$label —rate limiter aktif (tunggu ~12 detik antar login)"
  else
    fail "$label —status $code"
  fi
  return 1
}

check_role() {
  local label="$1" role="$2" jar="$3" code
  code="$(request "$BASE_URL/api/auth/me" -b "$jar")"
  if [[ "$code" == 200 ]] && grep -q "\"role\":\"$role\"" "$TMP_DIR/body"; then
    pass "$label"
  else
    fail "$label —status $code, role bukan '$role'"
  fi
}

check_header() {
  local label="$1" url="$2" header="$3" needle="$4" headers value
  headers="$(curl -sSI --max-time "$TIMEOUT" "$url" || true)"
  value="$(printf '%s' "$headers" | tr -d '\r' | awk -F': ' "tolower(\$1)==\"$(printf '%s' "$header" | tr 'A-Z' 'a-z')\" {print \$2}" | tail -n1)"
  if [[ "$value" == *"$needle"* ]]; then pass "$label ($value)"; else fail "$label —header '$header'='$value'"; fi
}

check_upload_content_type() {
  local label="$1" path="$2" require="${3:-$REQUIRE_NOSNIFF}" url headers ct nosniff code
  if [[ "$path" == http://* || "$path" == https://* ]]; then url="$path"; else url="$BASE_URL$path"; fi
  code="$(request "$url")"
  headers="$(curl -sSI --max-time "$TIMEOUT" "$url" || true)"
  ct="$(printf '%s' "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type" {print $2}' | tail -n1)"
  nosniff="$(printf '%s' "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-content-type-options" {print $2}' | tail -n1)"
  case "$ct" in
    image/jpeg*|image/png*|image/gif*|image/webp*|application/octet-stream*)
      if [[ "$require" == "1" ]]; then
        if [[ "$nosniff" == *nosniff* ]]; then
          pass "$label ($code, $ct, nosniff)"
        else
          fail "$label —header X-Content-Type-Options tidak ada"
        fi
      else
        pass "$label ($code, $ct; nosniff tidak diwajibkan untuk aset statik)"
      fi ;;
    *) fail "$label —Content-Type mencurigakan: '$ct'" ;;
  esac
}

echo "=== Smoke test Kaliaja.coffe ==="
echo "Target: $BASE_URL"
echo

# --- 1. HTTPS, halaman aplikasi, dan header keamanan -----------------------
echo "[1] HTTPS & halaman aplikasi"
if [[ "$BASE_URL" == https://* ]]; then
  check_status "HTTP dialihkan ke HTTPS" "http://$HOST_HEADER/" "301 302 308"
  if [[ "$SKIP_PAGE_HEADER_CHECKS" == "1" ]]; then
    skip "HSTS halaman —dikelola platform (Vercel)"
  else
    check_header "HSTS aktif" "$BASE_URL/" "Strict-Transport-Security" "max-age="
  fi
else
  skip "Redirect HTTPS & HSTS —BASE_URL bukan HTTPS (mode lokal)"
fi
check_body "Landing page termuat" "$BASE_URL/" "Kaliaja"
if [[ "$REQUIRE_NOSNIFF" -eq 1 && "$SKIP_PAGE_HEADER_CHECKS" != "1" ]]; then
  check_header "Nosniff pada halaman" "$BASE_URL/" "X-Content-Type-Options" "nosniff"
else
  skip "Nosniff pada halaman —Vite dev / Vercel tidak menambah header Nginx"
fi

for route in / /menu /activities /login /register /forgot-password \
             /admin /admin/products /admin/activities /admin/transactions \
             /bos /bos/branding /404-tidak-ada; do
  check_body "Route SPA $route" "$BASE_URL$route" 'id="root"'
done
echo

# --- 2. Endpoint publik & aset branding ------------------------------------
echo "[2] API publik & branding"
check_status "Branding publik" "$BASE_URL/api/branding" "200"
check_json "Branding memuat logo & favicon" "$BASE_URL/api/branding" "" "logo_url"
check_json "Branding memuat favicon" "$BASE_URL/api/branding" "" "favicon_url"
check_status "Daftar kategori publik" "$BASE_URL/api/categories" "200"
check_status "Daftar produk publik" "$BASE_URL/api/products" "200"
check_status "Galeri kegiatan publik" "$BASE_URL/api/activities" "200"
check_status "Bootstrap sesi tamu sukses" "$BASE_URL/api/auth/session" "200"
check_status "Sesi tanpa login ditolak" "$BASE_URL/api/auth/me" "401"
check_no_leak "Error 401 tidak membocorkan detail" "$BASE_URL/api/auth/me"
check_status "Daftar transaksi Admin tanpa login ditolak" "$BASE_URL/api/transactions" "401"
check_status "Rekap BOS tanpa login ditolak" "$BASE_URL/api/bos/transactions" "401"
check_status "Stok BOS tanpa login ditolak" "$BASE_URL/api/bos/stocks" "401"

check_upload_content_type "Favicon bawaan" "/favicon.png" "$STATIC_NOSNIFF"
check_upload_content_type "Logo bawaan" "/images/logo-kopi-kaliaja-128.png" "$STATIC_NOSNIFF"
if [[ "$(request "$BASE_URL/api/products")" == 200 ]] && grep -q 'image_url' "$TMP_DIR/body"; then
  first_image="$(grep -o '"image_url"[[:space:]]*:[[:space:]]*"[^"]*"' "$TMP_DIR/body" | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
  if [[ -n "$first_image" ]]; then
    check_upload_content_type "Foto produk dari API" "$first_image"
  fi
else
  skip "Foto produk dari API —tidak ada produk/image_url"
fi
if [[ -n "$RECEIPT_PATH" ]]; then
  check_upload_content_type "Struk ($RECEIPT_PATH)" "$RECEIPT_PATH"
else
  skip "Content-Type struk —set RECEIPT_PATH=/uploads/receipts/<file> atau URL absolut"
fi
echo

# --- 3. Autentikasi, RBAC, dan data terproteksi ----------------------------
echo "[3] RBAC & dashboard terproteksi"
ADMIN_JAR="$TMP_DIR/admin.cookies"
BOS_JAR="$TMP_DIR/bos.cookies"
CUSTOMER_JAR="$TMP_DIR/customer.cookies"
ADMIN_OK=0
BOS_OK=0
CUSTOMER_OK=0

if login "Login admin" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_JAR"; then
  ADMIN_OK=1
  check_role "Role admin valid" "admin" "$ADMIN_JAR"
  check_json "Daftar transaksi Admin" "$BASE_URL/api/transactions" "$ADMIN_JAR" "receipt_url"
  check_json "Ringkasan transaksi Admin" "$BASE_URL/api/transactions" "$ADMIN_JAR" "total_in"
  check_forbidden "Admin tidak bisa akses rekap BOS" "$BASE_URL/api/bos/transactions" "$ADMIN_JAR"
fi
if login "Login BOS" "$BOS_EMAIL" "$BOS_PASSWORD" "$BOS_JAR"; then
  BOS_OK=1
  check_role "Role BOS valid" "bos" "$BOS_JAR"
  check_json "Rekap transaksi BOS" "$BASE_URL/api/bos/transactions" "$BOS_JAR" "receipt_url"
  check_json "Stok BOS" "$BASE_URL/api/bos/stocks" "$BOS_JAR" "low_stock"
  check_forbidden "BOS tidak bisa akses daftar transaksi Admin" "$BASE_URL/api/transactions" "$BOS_JAR"
  check_forbidden "BOS tidak bisa tambah produk" "$BASE_URL/api/products" "$BOS_JAR" -X POST
fi
if login "Login customer" "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD" "$CUSTOMER_JAR"; then
  CUSTOMER_OK=1
  check_role "Role customer valid" "customer" "$CUSTOMER_JAR"
  check_forbidden "Customer tidak bisa akses transaksi Admin" "$BASE_URL/api/transactions" "$CUSTOMER_JAR"
  check_forbidden "Customer tidak bisa akses rekap BOS" "$BASE_URL/api/bos/transactions" "$CUSTOMER_JAR"
  check_forbidden "Customer tidak bisa upload struk" "$BASE_URL/api/transactions/1/receipt" "$CUSTOMER_JAR" -X POST
fi
if [[ "$ADMIN_OK" -eq 0 && "$BOS_OK" -eq 0 && "$CUSTOMER_OK" -eq 0 ]]; then
  skip "Pengecekan role lanjutan —set kredensial SMOKE_*_EMAIL/PASSWORD"
fi
echo

# --- 4. Alur struk: validasi, upload, tampil di rekap, hapus ---------------
echo "[4] Alur upload struk (opsional)"
if [[ "$ADMIN_OK" -eq 1 && -n "$SMOKE_TRANSACTION_ID" ]]; then
  printf 'ini bukan gambar' > "$FAKE_FILE"
  code="$(curl -sS -o "$TMP_DIR/body" -w '%{http_code}' --max-time "$TIMEOUT" \
    -b "$ADMIN_JAR" -X POST \
    -F "receipt=@$FAKE_FILE;type=image/jpeg" \
    "$BASE_URL/api/transactions/$SMOKE_TRANSACTION_ID/receipt" || true)"
  if [[ "$code" == 400 || "$code" == 413 ]]; then
    pass "File bukan gambar ditolak ($code)"
  else
    fail "File bukan gambar harus ditolak, dapat $code"
  fi

  if [[ -n "$SMOKE_RECEIPT_FILE" && -f "$SMOKE_RECEIPT_FILE" ]]; then
    code="$(curl -sS -o "$TMP_DIR/body" -w '%{http_code}' --max-time "$TIMEOUT" \
      -b "$ADMIN_JAR" -X POST -F "receipt=@$SMOKE_RECEIPT_FILE" \
      "$BASE_URL/api/transactions/$SMOKE_TRANSACTION_ID/receipt" || true)"
    receipt_url="$(grep -o '"receipt_url"[[:space:]]*:[[:space:]]*"[^"]*"' "$TMP_DIR/body" | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
    if [[ "$code" == 200 && ( "$receipt_url" == /uploads/* || "$receipt_url" == https://res.cloudinary.com/* ) ]]; then
      pass "Upload struk berhasil ($receipt_url)"
      check_upload_content_type "Struk hasil upload" "$receipt_url"
      check_json "Struk muncul di daftar Admin" "$BASE_URL/api/transactions?q=$SMOKE_TRANSACTION_ID" "$ADMIN_JAR" "$receipt_url"
      if [[ "$BOS_OK" -eq 1 ]]; then
        check_json "Struk muncul di rekap BOS" "$BASE_URL/api/bos/transactions" "$BOS_JAR" "$receipt_url"
      else
        skip "Struk di rekap BOS —kredensial BOS tidak tersedia"
      fi
      code="$(curl -sS -o "$TMP_DIR/body" -w '%{http_code}' --max-time "$TIMEOUT" \
        -b "$ADMIN_JAR" -X DELETE \
        "$BASE_URL/api/transactions/$SMOKE_TRANSACTION_ID/receipt" || true)"
      if [[ "$code" == 200 ]]; then pass "Hapus struk berhasil"; else fail "Hapus struk —status $code"; fi
    else
      fail "Upload struk —status $code, receipt_url='$receipt_url'"
    fi
  else
    skip "Upload/hapus struk penuh —set SMOKE_RECEIPT_FILE"
  fi
else
  skip "Uji struk —butuh login admin & SMOKE_TRANSACTION_ID"
fi
echo

echo "=== Ringkasan: $PASS PASS, $FAIL FAIL, $SKIP SKIP ==="
if [[ "$FAIL" -eq 0 ]]; then
  echo "SMOKE TEST LULUS"
else
  echo "SMOKE TEST GAGAL"
fi
exit "$FAIL"
