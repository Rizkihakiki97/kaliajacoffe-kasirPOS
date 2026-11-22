package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config menyimpan semua konfigurasi aplikasi dari environment / file .env.
type Config struct {
	AppEnv string
	Port   string
	AppURL string

	DBHost string
	DBPort string
	DBUser string
	DBPass string
	DBName string
	DBTLS  string

	JWTSecret    []byte
	JWTExpiry    time.Duration
	CookieSecure bool

	AllowedOrigin  string
	TrustedProxies []string
	UploadDir      string
	MaxUploadByte  int64

	// Penyimpanan gambar. "local" untuk VPS, "cloudinary" untuk hosting
	// dengan filesystem tidak persisten (Render, Fly.io, dll).
	StorageDriver  string
	CloudName      string
	CloudAPIKey    string
	CloudAPISecret string
	CloudFolder    string

	SMTPHost string
	SMTPPort string
	SMTPUser string
	SMTPPass string
	SMTPFrom string

	SeedAdminEmail    string
	SeedAdminPassword string
	SeedBOSEmail      string
	SeedBOSPassword   string
}

func Load() *Config {
	// Abaikan error jika file .env tidak ada (mis. sudah pakai env vars langsung).
	_ = godotenv.Load()

	const devJWTSecret = "dev-only-change-this-secret-kaliaja-coffe-2026"
	appEnv := strings.ToLower(strings.TrimSpace(env("APP_ENV", "dev")))
	switch appEnv {
	case "dev", "staging", "production":
	default:
		log.Fatalf("APP_ENV tidak dikenal: %q (gunakan dev|staging|production)", appEnv)
	}
	isProduction := appEnv == "production"

	secret, secretSet := os.LookupEnv("JWT_SECRET")
	if !secretSet || secret == "" {
		secret = devJWTSecret
	}
	// Nilai contoh sengaja ditolak di produksi: panjangnya > 32 karakter,
	// sehingga pemeriksaan panjang saja tidak cukup untuk mencegah
	// penyerang memalsukan JWT dengan kunci yang sudah diketahui publik.
	if isProduction && (!secretSet || secret == devJWTSecret || len(secret) < 32) {
		log.Fatal("JWT_SECRET wajib diisi rahasia unik minimal 32 karakter di production (jangan pakai nilai contoh)")
	}
	if isProduction && !envBool("COOKIE_SECURE", false) {
		log.Fatal("COOKIE_SECURE wajib true di production agar cookie hanya dikirim lewat HTTPS")
	}
	if isProduction && strings.TrimSpace(env("SMTP_HOST", "")) == "" {
		log.Fatal("SMTP_HOST wajib diisi di production agar token reset password tidak ditulis ke log")
	}
	if isProduction && !strings.HasPrefix(strings.TrimSpace(env("ALLOWED_ORIGIN", "")), "https://") {
		log.Fatal("ALLOWED_ORIGIN wajib berupa URL https:// di production")
	}

	storageDriver := strings.ToLower(strings.TrimSpace(env("STORAGE_DRIVER", "local")))
	switch storageDriver {
	case "local", "cloudinary":
	default:
		log.Fatalf("STORAGE_DRIVER tidak dikenal: %q (gunakan local|cloudinary)", storageDriver)
	}
	if storageDriver == "cloudinary" {
		for key, value := range map[string]string{
			"CLOUDINARY_CLOUD_NAME": env("CLOUDINARY_CLOUD_NAME", ""),
			"CLOUDINARY_API_KEY":    env("CLOUDINARY_API_KEY", ""),
			"CLOUDINARY_API_SECRET": env("CLOUDINARY_API_SECRET", ""),
		} {
			if strings.TrimSpace(value) == "" {
				log.Fatalf("%s wajib diisi saat STORAGE_DRIVER=cloudinary", key)
			}
		}
	}

	expiryHours, err := strconv.Atoi(env("JWT_EXPIRY_HOURS", "24"))
	if err != nil || expiryHours <= 0 {
		expiryHours = 24
	}

	maxMB, err := strconv.ParseInt(env("MAX_UPLOAD_MB", "5"), 10, 64)
	if err != nil || maxMB <= 0 {
		maxMB = 5
	}

	trusted := []string{}
	for _, item := range strings.Split(env("TRUSTED_PROXIES", ""), ",") {
		if proxy := strings.TrimSpace(item); proxy != "" {
			trusted = append(trusted, proxy)
		}
	}
	if len(trusted) == 0 {
		trusted = []string{"127.0.0.1"}
	}

	// Render/PaaS menyediakan PORT; gunakan sebagai fallback agar aplikasi
	// selalu mendengar pada port yang ditentukan platform.
	port := env("APP_PORT", "")
	if port == "" {
		port = env("PORT", "8080")
	}

	return &Config{
		AppEnv: appEnv,
		Port:   port,
		AppURL: strings.TrimRight(env("APP_URL", "http://localhost:5173"), "/"),

		DBHost: env("DB_HOST", "127.0.0.1"),
		DBPort: env("DB_PORT", "3306"),
		DBUser: env("DB_USER", "root"),
		DBPass: env("DB_PASS", ""),
		DBName: env("DB_NAME", "kaliaja_coffe"),
		DBTLS:  strings.TrimSpace(env("DB_TLS", "")),

		JWTSecret:    []byte(secret),
		JWTExpiry:    time.Duration(expiryHours) * time.Hour,
		CookieSecure: envBool("COOKIE_SECURE", false),

		AllowedOrigin:  env("ALLOWED_ORIGIN", "http://localhost:5173"),
		TrustedProxies: trusted,
		UploadDir:      env("UPLOAD_DIR", "./uploads"),
		MaxUploadByte:  maxMB << 20,

		StorageDriver:  storageDriver,
		CloudName:      strings.TrimSpace(env("CLOUDINARY_CLOUD_NAME", "")),
		CloudAPIKey:    strings.TrimSpace(env("CLOUDINARY_API_KEY", "")),
		CloudAPISecret: strings.TrimSpace(env("CLOUDINARY_API_SECRET", "")),
		CloudFolder:    strings.Trim(strings.ReplaceAll(env("CLOUDINARY_FOLDER", "kaliaja"), "\\", "/"), "/"),

		SMTPHost: env("SMTP_HOST", ""),
		SMTPPort: env("SMTP_PORT", "587"),
		SMTPUser: env("SMTP_USER", ""),
		SMTPPass: env("SMTP_PASS", ""),
		SMTPFrom: env("SMTP_FROM", "no-reply@kaliaja.coffe"),

		SeedAdminEmail:    env("SEED_ADMIN_EMAIL", "admin@kaliaja.coffe"),
		SeedAdminPassword: env("SEED_ADMIN_PASSWORD", "Admin123!"),
		SeedBOSEmail:      env("SEED_BOS_EMAIL", "bos@kaliaja.coffe"),
		SeedBOSPassword:   env("SEED_BOS_PASSWORD", "Bos123!"),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}
