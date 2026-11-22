package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"kaliaja.coffe/backend/internal/middleware"
	"kaliaja.coffe/backend/internal/models"
	"kaliaja.coffe/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type orderItemInput struct {
	ProductID uint64 `json:"product_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,min=1"`
}

type orderInput struct {
	CustomerID uint64           `json:"customer_id"`
	Items      []orderItemInput `json:"items" binding:"required,min=1"`
}

type transactionResponse struct {
	models.Transaction
	Items []models.TransactionItem `json:"items"`
}

// CreatePOS dipakai Admin. source = 'pos', flow_type = 'out'.
func CreatePOS(db *gorm.DB) gin.HandlerFunc {
	return processOrder(db, "pos")
}

// CreateOrder dipakai Customer. source = 'order', flow_type = 'in'.
func CreateOrder(db *gorm.DB) gin.HandlerFunc {
	return processOrder(db, "order")
}

func processOrder(db *gorm.DB, source string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input orderInput
		if err := c.ShouldBindJSON(&input); err != nil {
			utils.Fail(c, http.StatusBadRequest, "Data transaksi tidak valid")
			return
		}

		actorID, ok := middleware.CurrentUserID(c)
		if !ok {
			utils.Fail(c, http.StatusUnauthorized, "Sesi tidak valid")
			return
		}

		var customerID, cashierID *uint64
		if source == "order" {
			// Customer tidak boleh memaksa customer_id milik akun lain (anti-IDOR).
			customerID = &actorID
		} else {
			cashierID = &actorID
			if input.CustomerID > 0 {
				customerID = &input.CustomerID
			}
		}

		// Gabungkan item yang sama agar stok tidak dipotong dua kali.
		quantities := map[uint64]int{}
		order := make([]uint64, 0, len(input.Items))
		for _, item := range input.Items {
			if _, exists := quantities[item.ProductID]; !exists {
				order = append(order, item.ProductID)
			}
			quantities[item.ProductID] += item.Quantity
		}
		// Kunci baris selalu dalam urutan ID yang sama untuk mencegah deadlock
		// saat dua transaksi memesan produk berbeda dengan urutan berlawanan.
		sort.Slice(order, func(i, j int) bool { return order[i] < order[j] })

		flowType := "in"
		if source == "pos" {
			flowType = "out"
		}

		tx := db.Begin()
		if tx.Error != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal memulai transaksi")
			return
		}
		defer func() {
			if recovered := recover(); recovered != nil {
				_ = tx.Rollback()
				panic(recovered)
			}
		}()

		var items []models.TransactionItem
		var total float64

		for _, productID := range order {
			quantity := quantities[productID]

			var product models.Product
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&product, productID).Error; err != nil {
				_ = tx.Rollback()
				if errors.Is(err, gorm.ErrRecordNotFound) {
					utils.Fail(c, http.StatusBadRequest, "Produk tidak ditemukan")
				} else {
					utils.Fail(c, http.StatusInternalServerError, "Gagal memeriksa stok")
				}
				return
			}
			if product.Stock < quantity {
				_ = tx.Rollback()
				utils.Fail(c, http.StatusBadRequest, "Stok "+product.Name+" tidak mencukupi")
				return
			}

			subtotal := product.Price * float64(quantity)
			total += subtotal
			items = append(items, models.TransactionItem{
				ProductID: productID,
				Quantity:  quantity,
				Price:     product.Price,
				Subtotal:  subtotal,
			})

			if err := tx.Model(&models.Product{}).Where("id = ?", productID).
				UpdateColumn("stock", gorm.Expr("stock - ?", quantity)).Error; err != nil {
				_ = tx.Rollback()
				utils.Fail(c, http.StatusInternalServerError, "Gagal memperbarui stok")
				return
			}
		}

		transaction := models.Transaction{
			InvoiceCode: generateInvoice(),
			Source:      source,
			CashierID:   cashierID,
			CustomerID:  customerID,
			FlowType:    flowType,
			TotalAmount: total,
			Status:      "completed",
		}
		if err := tx.Create(&transaction).Error; err != nil {
			_ = tx.Rollback()
			utils.Fail(c, http.StatusInternalServerError, "Gagal menyimpan transaksi")
			return
		}

		for index := range items {
			items[index].TransactionID = transaction.ID
		}
		if err := tx.Create(&items).Error; err != nil {
			_ = tx.Rollback()
			utils.Fail(c, http.StatusInternalServerError, "Gagal menyimpan detail transaksi")
			return
		}

		if err := tx.Commit().Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal menyelesaikan transaksi")
			return
		}

		utils.Created(c, "Transaksi berhasil", transactionResponse{
			Transaction: transaction,
			Items:       items,
		})
	}
}

func generateInvoice() string {
	randomBytes := make([]byte, 8)
	_, _ = rand.Read(randomBytes)
	return "KC-" + time.Now().Format("20060102") + "-" + strings.ToUpper(hex.EncodeToString(randomBytes))
}
