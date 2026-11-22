package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"kaliaja.coffe/backend/internal/config"
	"kaliaja.coffe/backend/internal/models"
	"kaliaja.coffe/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type productDTO struct {
	models.Product
	CategoryName string `json:"category_name"`
}

func ListProducts(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := db.Order("name ASC")

		if category := strings.TrimSpace(c.Query("category")); category != "" {
			var found models.Category
			if err := db.Where("slug = ? OR name = ?", strings.ToLower(category), category).First(&found).Error; err == nil {
				query = query.Where("category_id = ?", found.ID)
			}
		}
		if q := strings.TrimSpace(c.Query("q")); q != "" {
			query = query.Where("name LIKE ?", "%"+q+"%")
		}

		var products []models.Product
		if err := query.Find(&products).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal mengambil daftar menu")
			return
		}

		categories := map[uint64]string{}
		var allCategories []models.Category
		_ = db.Find(&allCategories).Error
		for _, category := range allCategories {
			categories[category.ID] = category.Name
		}

		result := make([]productDTO, 0, len(products))
		for _, product := range products {
			result = append(result, productDTO{
				Product:      product,
				CategoryName: categories[product.CategoryID],
			})
		}
		utils.OK(c, "Daftar menu", result)
	}
}

func CreateProduct(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		categoryID, err := strconv.ParseUint(c.PostForm("category_id"), 10, 64)
		if err != nil || categoryID == 0 {
			utils.Fail(c, http.StatusBadRequest, "Kategori tidak valid")
			return
		}
		name := strings.TrimSpace(c.PostForm("name"))
		if name == "" {
			utils.Fail(c, http.StatusBadRequest, "Nama produk wajib diisi")
			return
		}
		price, err := strconv.ParseFloat(c.PostForm("price"), 64)
		if err != nil || price <= 0 {
			utils.Fail(c, http.StatusBadRequest, "Harga harus lebih dari 0")
			return
		}
		stock, err := strconv.Atoi(c.PostForm("stock"))
		if err != nil || stock < 0 {
			utils.Fail(c, http.StatusBadRequest, "Stok tidak valid")
			return
		}

		var count int64
		if err := db.Model(&models.Category{}).Where("id = ?", categoryID).Count(&count).Error; err != nil || count == 0 {
			utils.Fail(c, http.StatusBadRequest, "Kategori tidak ditemukan")
			return
		}

		imageURL, provided, err := utils.SaveImage(c, "image", "products", cfg.UploadDir, cfg.MaxUploadByte)
		if err != nil {
			log.Printf("gagal menyimpan foto produk: %v", err)
			utils.Fail(c, http.StatusBadRequest, "Foto produk tidak valid")
			return
		}
		if !provided {
			utils.Fail(c, http.StatusBadRequest, "Foto produk wajib diunggah")
			return
		}

		product := models.Product{
			CategoryID:  categoryID,
			Name:        name,
			Description: strings.TrimSpace(c.PostForm("description")),
			Price:       price,
			Stock:       stock,
			ImageURL:    imageURL,
		}
		if err := db.Create(&product).Error; err != nil {
			_ = utils.DeleteImage(cfg.UploadDir, imageURL)
			utils.Fail(c, http.StatusInternalServerError, "Gagal menyimpan produk")
			return
		}
		utils.Created(c, "Produk ditambahkan", product)
	}
}

func UpdateProduct(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || id == 0 {
			utils.Fail(c, http.StatusBadRequest, "ID produk tidak valid")
			return
		}
		var product models.Product
		if err := db.First(&product, id).Error; err != nil {
			utils.Fail(c, http.StatusNotFound, "Produk tidak ditemukan")
			return
		}

		// GORM mengubah field struct saat Updates dijalankan, jadi simpan URL lama lebih awal.
		oldImageURL := product.ImageURL
		updates := map[string]any{}

		if value, provided := formValue(c, "category_id"); provided {
			categoryID, err := strconv.ParseUint(value, 10, 64)
			if err != nil || categoryID == 0 {
				utils.Fail(c, http.StatusBadRequest, "Kategori tidak valid")
				return
			}
			var count int64
			_ = db.Model(&models.Category{}).Where("id = ?", categoryID).Count(&count)
			if count == 0 {
				utils.Fail(c, http.StatusBadRequest, "Kategori tidak ditemukan")
				return
			}
			updates["category_id"] = categoryID
		}
		if value, provided := formValue(c, "name"); provided {
			value = strings.TrimSpace(value)
			if value == "" {
				utils.Fail(c, http.StatusBadRequest, "Nama produk tidak boleh kosong")
				return
			}
			updates["name"] = value
		}
		if value, provided := formValue(c, "description"); provided {
			updates["description"] = strings.TrimSpace(value)
		}
		if value, provided := formValue(c, "price"); provided {
			price, err := strconv.ParseFloat(value, 64)
			if err != nil || price <= 0 {
				utils.Fail(c, http.StatusBadRequest, "Harga harus lebih dari 0")
				return
			}
			updates["price"] = price
		}
		if value, provided := formValue(c, "stock"); provided {
			stock, err := strconv.Atoi(value)
			if err != nil || stock < 0 {
				utils.Fail(c, http.StatusBadRequest, "Stok tidak valid")
				return
			}
			updates["stock"] = stock
		}

		imageURL, imageProvided, err := utils.SaveImage(c, "image", "products", cfg.UploadDir, cfg.MaxUploadByte)
		if err != nil {
			log.Printf("gagal menyimpan foto produk: %v", err)
			utils.Fail(c, http.StatusBadRequest, "Foto produk tidak valid")
			return
		}
		if imageProvided {
			updates["image_url"] = imageURL
		}

		if len(updates) > 0 {
			if err := db.Model(&product).Updates(updates).Error; err != nil {
				if imageProvided {
					_ = utils.DeleteImage(cfg.UploadDir, imageURL)
				}
				utils.Fail(c, http.StatusInternalServerError, "Gagal memperbarui produk")
				return
			}
		}
		if imageProvided && oldImageURL != "" && oldImageURL != imageURL {
			_ = utils.DeleteImage(cfg.UploadDir, oldImageURL)
		}

		var result models.Product
		_ = db.First(&result, id)
		utils.OK(c, "Produk diperbarui", result)
	}
}

func DeleteProduct(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || id == 0 {
			utils.Fail(c, http.StatusBadRequest, "ID produk tidak valid")
			return
		}
		var product models.Product
		if err := db.First(&product, id).Error; err != nil {
			utils.Fail(c, http.StatusNotFound, "Produk tidak ditemukan")
			return
		}

		var used int64
		_ = db.Model(&models.TransactionItem{}).Where("product_id = ?", id).Count(&used).Error
		if used > 0 {
			utils.Fail(c, http.StatusConflict, "Produk sudah digunakan dalam transaksi dan tidak dapat dihapus")
			return
		}

		if err := db.Delete(&product).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal menghapus produk")
			return
		}
		_ = utils.DeleteImage(cfg.UploadDir, product.ImageURL)
		utils.OK(c, "Produk dihapus", nil)
	}
}
