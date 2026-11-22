-- ============================================================
-- Kaliaja.coffe — MySQL Schema
-- Versi: 1.0 (sesuai PRD.MD)
-- Cara pakai: mysql -u root -p < db/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS kaliaja_coffe
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kaliaja_coffe;

-- ------------------------------------------------------------
-- users: customer, admin, bos + token reset password
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                    VARCHAR(100)    NOT NULL,
  email                   VARCHAR(191)    NOT NULL,
  password_hash           VARCHAR(255)    NOT NULL,
  role                    VARCHAR(20)     NOT NULL DEFAULT 'customer',
  reset_token             VARCHAR(255)    DEFAULT NULL,
  reset_token_expires_at  DATETIME        DEFAULT NULL,
  created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_reset_token (reset_token),
  CONSTRAINT chk_users_role CHECK (role IN ('customer', 'admin', 'bos'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- branding_settings: logo & favicon (baris id = 1 adalah aktif)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branding_settings (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  brand_name   VARCHAR(100) NOT NULL DEFAULT 'Kaliaja.coffe',
  logo_url     VARCHAR(500) DEFAULT NULL,
  favicon_url  VARCHAR(500) DEFAULT NULL,
  updated_by   BIGINT UNSIGNED DEFAULT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_branding_updated_by (updated_by),
  CONSTRAINT fk_branding_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO branding_settings (id, brand_name, logo_url, favicon_url)
VALUES (1, 'Kaliaja.coffe', NULL, NULL)
ON DUPLICATE KEY UPDATE brand_name = brand_name;

-- ------------------------------------------------------------
-- categories: Coffee, Non-Coffee, Snack (fixed, sesuai PRD)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50)  NOT NULL,
  slug       VARCHAR(50)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO categories (name, slug) VALUES
  ('Coffee',     'coffee'),
  ('Non-Coffee', 'non-coffee'),
  ('Snack',      'snack')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ------------------------------------------------------------
-- products: menu + stok (stok hanya diubah admin & transaksi)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id  INT UNSIGNED    NOT NULL,
  name         VARCHAR(150)   NOT NULL,
  description  TEXT           DEFAULT NULL,
  price        DECIMAL(12,2)  NOT NULL,
  stock        INT UNSIGNED    NOT NULL DEFAULT 0,
  image_url    VARCHAR(500)   DEFAULT NULL,
  created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_category (category_id),
  KEY idx_products_name (name),
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_products_price CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- activities: galeri foto kegiatan (CRUD admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title       VARCHAR(150) NOT NULL,
  description TEXT         DEFAULT NULL,
  image_url   VARCHAR(500) NOT NULL,
  event_date  DATE         NOT NULL,
  created_by  BIGINT UNSIGNED DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activities_date (event_date),
  KEY idx_activities_created_by (created_by),
  CONSTRAINT fk_activities_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- transactions
-- flow_type: 'in'  = pesanan customer (order masuk)
--            'out' = transaksi kasir admin (penjualan langsung)
-- status: pending | paid | completed | cancelled
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_code  VARCHAR(50)    NOT NULL,
  source        VARCHAR(20)    NOT NULL,
  cashier_id    BIGINT UNSIGNED DEFAULT NULL,
  customer_id   BIGINT UNSIGNED DEFAULT NULL,
  flow_type     VARCHAR(10)    NOT NULL,
  total_amount  DECIMAL(12,2)  NOT NULL,
  status        VARCHAR(20)    NOT NULL DEFAULT 'completed',
  receipt_url   VARCHAR(500)   DEFAULT NULL,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_invoice (invoice_code),
  KEY idx_transactions_source (source),
  KEY idx_transactions_flow (flow_type),
  KEY idx_transactions_status (status),
  KEY idx_transactions_created (created_at),
  KEY idx_transactions_customer (customer_id),
  KEY idx_transactions_cashier (cashier_id),
  CONSTRAINT chk_transactions_source  CHECK (source IN ('pos', 'order')),
  CONSTRAINT chk_transactions_flow    CHECK (flow_type IN ('in', 'out')),
  CONSTRAINT chk_transactions_status  CHECK (status IN ('pending', 'paid', 'completed', 'cancelled')),
  CONSTRAINT fk_transactions_cashier
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_transactions_customer
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- transaction_items: detail tiap transaksi
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaction_items (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id  BIGINT UNSIGNED NOT NULL,
  product_id      BIGINT UNSIGNED NOT NULL,
  quantity        INT UNSIGNED    NOT NULL,
  price           DECIMAL(12,2)   NOT NULL,
  subtotal        DECIMAL(12,2)   NOT NULL,
  PRIMARY KEY (id),
  KEY idx_items_transaction (transaction_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_items_transaction
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT chk_items_quantity CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
