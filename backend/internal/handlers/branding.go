package handlers

import (
	"log"
	"net/http"
	"strings"

	"kaliaja.coffe/backend/internal/config"
	"kaliaja.coffe/backend/internal/middleware"
	"kaliaja.coffe/backend/internal/models"
	"kaliaja.coffe/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetBranding(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var branding models.Branding
		if err := db.First(&branding, 1).Error; err != nil {
			utils.OK(c, "Branding", gin.H{
				"brand_name":  "Kaliaja.coffe",
				"logo_url":    "",
				"favicon_url": "",
			})
			return
		}
		utils.OK(c, "Branding", gin.H{
			"brand_name":  branding.BrandName,
			"logo_url":    branding.LogoURL,
			"favicon_url": branding.FaviconURL,
		})
	}
}

func UpdateBranding(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		branding := models.Branding{ID: 1}
		if err := db.FirstOrCreate(&branding, models.Branding{ID: 1}).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal mengambil pengaturan branding")
			return
		}

		// Simpan URL lama sebelum Updates karena GORM menimpa field pada struct.
		oldLogo, oldFavicon := branding.LogoURL, branding.FaviconURL
		updates := map[string]any{}
		if name, provided := formValue(c, "brand_name"); provided {
			name = strings.TrimSpace(name)
			if name == "" || len(name) > 100 {
				utils.Fail(c, http.StatusBadRequest, "Nama brand tidak valid")
				return
			}
			updates["brand_name"] = name
		}

		logoURL, logoProvided, err := utils.SaveImage(c, "logo", "branding", cfg.UploadDir, cfg.MaxUploadByte)
		if err != nil {
			log.Printf("gagal menyimpan logo: %v", err)
			utils.Fail(c, http.StatusBadRequest, "Logo tidak valid")
			return
		}
		if logoProvided {
			updates["logo_url"] = logoURL
			// Favicon mengikuti logo jika tidak diunggah terpisah (sesuai PRD).
			updates["favicon_url"] = logoURL
		}

		faviconURL, faviconProvided, err := utils.SaveImage(c, "favicon", "branding", cfg.UploadDir, cfg.MaxUploadByte)
		if err != nil {
			log.Printf("gagal menyimpan favicon: %v", err)
			utils.Fail(c, http.StatusBadRequest, "Favicon tidak valid")
			return
		}
		if faviconProvided {
			updates["favicon_url"] = faviconURL
		}

		if userID, ok := middleware.CurrentUserID(c); ok {
			updates["updated_by"] = userID
		}
		if branding.BrandName == "" {
			updates["brand_name"] = "Kaliaja.coffe"
		}

		if len(updates) > 0 {
			if err := db.Model(&branding).Updates(updates).Error; err != nil {
				if logoProvided {
					_ = utils.DeleteImage(cfg.UploadDir, logoURL)
				}
				if faviconProvided && faviconURL != logoURL {
					_ = utils.DeleteImage(cfg.UploadDir, faviconURL)
				}
				utils.Fail(c, http.StatusInternalServerError, "Gagal menyimpan branding")
				return
			}
		}

		newLogoURL, newFaviconURL := oldLogo, oldFavicon
		if value, ok := updates["logo_url"].(string); ok {
			newLogoURL = value
		}
		if value, ok := updates["favicon_url"].(string); ok {
			newFaviconURL = value
		}
		// Hapus berkas lama hanya jika tidak dipakai lagi oleh logo/favicon baru.
		if oldLogo != "" && oldLogo != newLogoURL && oldLogo != newFaviconURL {
			_ = utils.DeleteImage(cfg.UploadDir, oldLogo)
		}
		if oldFavicon != "" && oldFavicon != newFaviconURL && oldFavicon != newLogoURL {
			_ = utils.DeleteImage(cfg.UploadDir, oldFavicon)
		}

		var result models.Branding
		_ = db.First(&result, 1)
		utils.OK(c, "Branding diperbarui", gin.H{
			"brand_name":  result.BrandName,
			"logo_url":    result.LogoURL,
			"favicon_url": result.FaviconURL,
		})
	}
}
