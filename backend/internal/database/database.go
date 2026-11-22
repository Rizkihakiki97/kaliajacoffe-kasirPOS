package database

import (
	"fmt"
	"log"
	"time"

	"kaliaja.coffe/backend/internal/config"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect membuka koneksi MySQL.
// Struktur tabel bersumber dari db/schema.sql (+ migrasi di db/migrations/),
// bukan AutoMigrate, agar constraint/index/FK buatan kita tidak diubah GORM.
func Connect(cfg *config.Config) *gorm.DB {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUser, cfg.DBPass, cfg.DBHost, cfg.DBPort, cfg.DBName,
	)
	// TiDB Cloud / DB manager lain umumnya mewajibkan TLS. Nilai yang dikenal
	// go-sql-driver/mysql: true, skip-verify, preferred.
	if cfg.DBTLS != "" {
		dsn += "&tls=" + cfg.DBTLS
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("gagal terhubung ke database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("gagal mengambil koneksi sql: %v", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(25)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	return db
}
