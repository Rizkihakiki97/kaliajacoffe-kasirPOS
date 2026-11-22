package handlers

import (
	"net/http"
	"strings"
	"time"

	"kaliaja.coffe/backend/internal/models"
	"kaliaja.coffe/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type transactionSummary struct {
	TotalIn  float64 `json:"total_in"`
	TotalOut float64 `json:"total_out"`
	Count    int64   `json:"count"`
}

type transactionWithItems struct {
	models.Transaction
	Items []models.TransactionItem `json:"items"`
}

type stockDTO struct {
	ID           uint64  `json:"id"`
	Name         string  `json:"name"`
	CategoryName string  `json:"category_name"`
	Price        float64 `json:"price"`
	Stock        int     `json:"stock"`
	LowStock     bool    `json:"low_stock"`
}

// applyTransactionFilters dipakai bersama oleh rekap BOS dan daftar transaksi Admin
// supaya hasil dan ringkasannya selalu konsisten.
func applyTransactionFilters(query *gorm.DB, c *gin.Context) *gorm.DB {
	if source := c.Query("source"); source == "pos" || source == "order" {
		query = query.Where("source = ?", source)
	}
	if flow := c.Query("flow_type"); flow == "in" || flow == "out" {
		query = query.Where("flow_type = ?", flow)
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("status = ?", status)
	}
	if start := c.Query("start"); start != "" {
		if parsed, err := time.Parse(eventDateLayout, start); err == nil {
			query = query.Where("created_at >= ?", parsed)
		}
	}
	if end := c.Query("end"); end != "" {
		if parsed, err := time.Parse(eventDateLayout, end); err == nil {
			query = query.Where("created_at < ?", parsed.AddDate(0, 0, 1))
		}
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		like := "%" + q + "%"
		query = query.Where("invoice_code LIKE ? OR CAST(id AS CHAR) LIKE ?", like, like)
	}
	return query
}

func listTransactions(db *gorm.DB, c *gin.Context, message string) {
	query := applyTransactionFilters(db.Model(&models.Transaction{}), c)

	var transactions []models.Transaction
	if err := query.Order("created_at DESC").Find(&transactions).Error; err != nil {
		utils.Fail(c, http.StatusInternalServerError, "Gagal mengambil transaksi")
		return
	}

	ids := make([]uint64, 0, len(transactions))
	for _, trx := range transactions {
		ids = append(ids, trx.ID)
	}
	itemsByTransaction := map[uint64][]models.TransactionItem{}
	if len(ids) > 0 {
		var items []models.TransactionItem
		if err := db.Where("transaction_id IN ?", ids).Find(&items).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal mengambil detail transaksi")
			return
		}
		for _, item := range items {
			itemsByTransaction[item.TransactionID] = append(itemsByTransaction[item.TransactionID], item)
		}
	}

	result := make([]transactionWithItems, 0, len(transactions))
	for _, trx := range transactions {
		result = append(result, transactionWithItems{
			Transaction: trx,
			Items:       itemsByTransaction[trx.ID],
		})
	}

	var summary transactionSummary
	_ = applyTransactionFilters(db.Model(&models.Transaction{}), c).
		Select("SUM(CASE WHEN flow_type = 'in' THEN total_amount ELSE 0 END) AS total_in, " +
			"SUM(CASE WHEN flow_type = 'out' THEN total_amount ELSE 0 END) AS total_out, " +
			"COUNT(*) AS count").
		Scan(&summary).Error

	utils.OK(c, message, gin.H{
		"summary":      summary,
		"transactions": result,
	})
}

// BOSListTransactions adalah rekap lengkap untuk role bos.
func BOSListTransactions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		listTransactions(db, c, "Rekap transaksi")
	}
}

// AdminListTransactions memberi Admin daftar transaksi nyata dari database,
// termasuk receipt_url, sehingga tidak bergantung pada penyimpanan lokal browser.
func AdminListTransactions(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		listTransactions(db, c, "Daftar transaksi")
	}
}

func BOSListStocks(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var products []models.Product
		if err := db.Order("stock ASC, name ASC").Find(&products).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal mengambil stok")
			return
		}

		categories := map[uint64]string{}
		var allCategories []models.Category
		_ = db.Find(&allCategories).Error
		for _, category := range allCategories {
			categories[category.ID] = category.Name
		}

		result := make([]stockDTO, 0, len(products))
		for _, product := range products {
			result = append(result, stockDTO{
				ID:           product.ID,
				Name:         product.Name,
				CategoryName: categories[product.CategoryID],
				Price:        product.Price,
				Stock:        product.Stock,
				LowStock:     product.Stock <= 5,
			})
		}
		utils.OK(c, "Stok barang", result)
	}
}
