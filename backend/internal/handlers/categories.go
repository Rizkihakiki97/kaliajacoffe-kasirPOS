package handlers

import (
	"net/http"

	"kaliaja.coffe/backend/internal/models"
	"kaliaja.coffe/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ListCategories dipakai frontend untuk mengisi filter menu dan form produk
// tanpa meng-hardcode ID kategori dari seed db/schema.sql.
func ListCategories(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var categories []models.Category
		if err := db.Order("id ASC").Find(&categories).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal mengambil daftar kategori")
			return
		}
		utils.OK(c, "Daftar kategori", categories)
	}
}
