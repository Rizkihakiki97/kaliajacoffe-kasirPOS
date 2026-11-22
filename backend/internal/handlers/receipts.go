package handlers

import (
	"log"
	"net/http"
	"strconv"

	"kaliaja.coffe/backend/internal/config"
	"kaliaja.coffe/backend/internal/models"
	"kaliaja.coffe/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// UploadReceipt mengunggah/mengganti struk (bukti pembayaran untuk customer)
// pada sebuah transaksi. Hak akses admin diverifikasi di layer route (RequireRole).
func UploadReceipt(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || id == 0 {
			utils.Fail(c, http.StatusBadRequest, "ID transaksi tidak valid")
			return
		}

		var transaction models.Transaction
		if err := db.First(&transaction, id).Error; err != nil {
			utils.Fail(c, http.StatusNotFound, "Transaksi tidak ditemukan")
			return
		}

		receiptURL, provided, err := utils.SaveImage(c, "receipt", "receipts", cfg.UploadDir, cfg.MaxUploadByte)
		if err != nil {
			log.Printf("gagal menyimpan struk: %v", err)
			utils.Fail(c, http.StatusBadRequest, "Struk tidak valid")
			return
		}
		if !provided {
			utils.Fail(c, http.StatusBadRequest, "File struk wajib diunggah")
			return
		}

		// Simpan URL lama SEBELUM Update: GORM menyalin nilai baru ke struct,
		// sehingga membaca transaction.ReceiptURL setelah Update akan menghapus file baru.
		oldURL := transaction.ReceiptURL
		if err := db.Model(&transaction).Update("receipt_url", receiptURL).Error; err != nil {
			_ = utils.DeleteImage(cfg.UploadDir, receiptURL)
			utils.Fail(c, http.StatusInternalServerError, "Gagal menyimpan struk")
			return
		}
		if oldURL != "" && oldURL != receiptURL {
			_ = utils.DeleteImage(cfg.UploadDir, oldURL)
		}

		transaction.ReceiptURL = receiptURL
		utils.OK(c, "Struk berhasil diunggah", transaction)
	}
}

// DeleteReceipt menghapus struk dari transaksi (admin).
func DeleteReceipt(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || id == 0 {
			utils.Fail(c, http.StatusBadRequest, "ID transaksi tidak valid")
			return
		}

		var transaction models.Transaction
		if err := db.First(&transaction, id).Error; err != nil {
			utils.Fail(c, http.StatusNotFound, "Transaksi tidak ditemukan")
			return
		}
		if transaction.ReceiptURL == "" {
			utils.Fail(c, http.StatusNotFound, "Transaksi ini belum memiliki struk")
			return
		}

		oldURL := transaction.ReceiptURL
		if err := db.Model(&transaction).Update("receipt_url", "").Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal menghapus struk")
			return
		}
		_ = utils.DeleteImage(cfg.UploadDir, oldURL)

		transaction.ReceiptURL = ""
		utils.OK(c, "Struk dihapus", transaction)
	}
}
