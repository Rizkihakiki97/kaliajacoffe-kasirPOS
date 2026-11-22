package models

import "time"

type Role string

const (
	RoleCustomer Role = "customer"
	RoleAdmin    Role = "admin"
	RoleBOS      Role = "bos"
)

// User menyimpan akun customer, admin, dan bos.
type User struct {
	ID                  uint64     `json:"id" gorm:"primaryKey;autoIncrement"`
	Name                string     `json:"name" gorm:"size:100;not null"`
	Email               string     `json:"email" gorm:"size:191;uniqueIndex;not null"`
	PasswordHash        string     `json:"-" gorm:"size:255;not null"`
	Role                Role       `json:"role" gorm:"size:20;not null;index"`
	ResetToken          string     `json:"-" gorm:"size:255;index"`
	ResetTokenExpiresAt *time.Time `json:"-" gorm:"column:reset_token_expires_at"`
	CreatedAt           time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt           time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

// Branding menyimpan identitas visual aktif (baris id = 1).
type Branding struct {
	ID         uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	BrandName  string    `json:"brand_name" gorm:"size:100;not null"`
	LogoURL    string    `json:"logo_url" gorm:"size:500"`
	FaviconURL string    `json:"favicon_url" gorm:"size:500"`
	UpdatedBy  *uint64   `json:"updated_by"`
	UpdatedAt  time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// Category: Coffee, Non-Coffee, Snack.
type Category struct {
	ID        uint64    `json:"id" gorm:"primaryKey;autoIncrement;type:int unsigned"`
	Name      string    `json:"name" gorm:"size:50;not null;uniqueIndex"`
	Slug      string    `json:"slug" gorm:"size:50;not null;uniqueIndex"`
	CreatedAt time.Time `json:"created_at" gorm:"autoCreateTime"`
}

// Product adalah menu kafe beserta harga dan stok.
type Product struct {
	ID          uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	CategoryID  uint64    `json:"category_id" gorm:"index;not null;type:int unsigned"`
	Name        string    `json:"name" gorm:"size:150;not null"`
	Description string    `json:"description" gorm:"type:text"`
	Price       float64   `json:"price" gorm:"type:decimal(12,2);not null"`
	Stock       int       `json:"stock" gorm:"not null;default:0"`
	ImageURL    string    `json:"image_url" gorm:"size:500"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// Activity adalah foto kegiatan kafe.
type Activity struct {
	ID          uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	Title       string    `json:"title" gorm:"size:150;not null"`
	Description string    `json:"description" gorm:"type:text"`
	ImageURL    string    `json:"image_url" gorm:"size:500;not null"`
	EventDate   time.Time `json:"event_date" gorm:"type:date;not null"`
	CreatedBy   *uint64   `json:"created_by"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// Transaction mencatat transaksi kasir (pos) maupun pesanan customer (order).
type Transaction struct {
	ID          uint64    `json:"id" gorm:"primaryKey;autoIncrement"`
	InvoiceCode string    `json:"invoice_code" gorm:"size:50;uniqueIndex;not null"`
	Source      string    `json:"source" gorm:"size:20;not null;index"`
	CashierID   *uint64   `json:"cashier_id"`
	CustomerID  *uint64   `json:"customer_id"`
	FlowType    string    `json:"flow_type" gorm:"size:10;not null;index"`
	TotalAmount float64   `json:"total_amount" gorm:"type:decimal(12,2);not null"`
	Status      string    `json:"status" gorm:"size:20;not null;default:completed;index"`
	ReceiptURL  string    `json:"receipt_url" gorm:"size:500"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

// TransactionItem adalah detail produk pada sebuah transaksi.
type TransactionItem struct {
	ID            uint64  `json:"id" gorm:"primaryKey;autoIncrement"`
	TransactionID uint64  `json:"transaction_id" gorm:"index;not null"`
	ProductID     uint64  `json:"product_id" gorm:"index;not null"`
	Quantity      int     `json:"quantity" gorm:"not null"`
	Price         float64 `json:"price" gorm:"type:decimal(12,2);not null"`
	Subtotal      float64 `json:"subtotal" gorm:"type:decimal(12,2);not null"`
}

// Pemetaan eksplisit ke nama tabel di db/schema.sql.
func (User) TableName() string            { return "users" }
func (Branding) TableName() string        { return "branding_settings" }
func (Category) TableName() string        { return "categories" }
func (Product) TableName() string         { return "products" }
func (Activity) TableName() string        { return "activities" }
func (Transaction) TableName() string     { return "transactions" }
func (TransactionItem) TableName() string { return "transaction_items" }
