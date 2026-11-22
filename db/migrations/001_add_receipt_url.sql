-- ============================================================
-- Migrasi: tambah kolom receipt_url pada tabel transactions
-- Aman dijalankan berulang (kompatibel MySQL 8 / MariaDB).
-- Cara: mysql -u root -p < db/migrations/001_add_receipt_url.sql
-- ============================================================

USE kaliaja_coffe;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'kaliaja_coffe'
    AND TABLE_NAME = 'transactions'
    AND COLUMN_NAME = 'receipt_url'
);

SET @sql := IF(
  @exists = 0,
  'ALTER TABLE transactions ADD COLUMN receipt_url VARCHAR(500) DEFAULT NULL AFTER status',
  'SELECT '' Kolom receipt_url sudah ada '''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
