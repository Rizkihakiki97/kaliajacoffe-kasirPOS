package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"kaliaja.coffe/backend/internal/config"
	"kaliaja.coffe/backend/internal/middleware"
	"kaliaja.coffe/backend/internal/models"
	"kaliaja.coffe/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const eventDateLayout = "2006-01-02"

func ListActivities(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var activities []models.Activity
		if err := db.Order("event_date DESC, created_at DESC").Find(&activities).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal mengambil galeri kegiatan")
			return
		}
		utils.OK(c, "Galeri kegiatan", activities)
	}
}

func CreateActivity(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		title := strings.TrimSpace(c.PostForm("title"))
		if title == "" {
			utils.Fail(c, http.StatusBadRequest, "Judul kegiatan wajib diisi")
			return
		}
		eventDate, err := time.Parse(eventDateLayout, c.PostForm("event_date"))
		if err != nil {
			utils.Fail(c, http.StatusBadRequest, "Tanggal kegiatan harus format YYYY-MM-DD")
			return
		}
		imageURL, provided, err := utils.SaveImage(c, "image", "activities", cfg.UploadDir, cfg.MaxUploadByte)
		if err != nil {
			log.Printf("gagal menyimpan foto kegiatan: %v", err)
			utils.Fail(c, http.StatusBadRequest, "Foto kegiatan tidak valid")
			return
		}
		if !provided {
			utils.Fail(c, http.StatusBadRequest, "Foto kegiatan wajib diunggah")
			return
		}

		activity := models.Activity{
			Title:       title,
			Description: strings.TrimSpace(c.PostForm("description")),
			ImageURL:    imageURL,
			EventDate:   eventDate,
		}
		if userID, ok := middleware.CurrentUserID(c); ok {
			activity.CreatedBy = &userID
		}
		if err := db.Create(&activity).Error; err != nil {
			_ = utils.DeleteImage(cfg.UploadDir, imageURL)
			utils.Fail(c, http.StatusInternalServerError, "Gagal menyimpan kegiatan")
			return
		}
		utils.Created(c, "Kegiatan ditambahkan", activity)
	}
}

func UpdateActivity(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || id == 0 {
			utils.Fail(c, http.StatusBadRequest, "ID kegiatan tidak valid")
			return
		}
		var activity models.Activity
		if err := db.First(&activity, id).Error; err != nil {
			utils.Fail(c, http.StatusNotFound, "Kegiatan tidak ditemukan")
			return
		}

		// Simpan URL lama sebelum Updates karena GORM menimpa field pada struct.
		oldImageURL := activity.ImageURL
		updates := map[string]any{}
		if value, provided := formValue(c, "title"); provided {
			value = strings.TrimSpace(value)
			if value == "" {
				utils.Fail(c, http.StatusBadRequest, "Judul tidak boleh kosong")
				return
			}
			updates["title"] = value
		}
		if value, provided := formValue(c, "description"); provided {
			updates["description"] = strings.TrimSpace(value)
		}
		if value, provided := formValue(c, "event_date"); provided {
			date, err := time.Parse(eventDateLayout, value)
			if err != nil {
				utils.Fail(c, http.StatusBadRequest, "Tanggal kegiatan harus format YYYY-MM-DD")
				return
			}
			updates["event_date"] = date
		}

		imageURL, imageProvided, err := utils.SaveImage(c, "image", "activities", cfg.UploadDir, cfg.MaxUploadByte)
		if err != nil {
			log.Printf("gagal menyimpan foto kegiatan: %v", err)
			utils.Fail(c, http.StatusBadRequest, "Foto kegiatan tidak valid")
			return
		}
		if imageProvided {
			updates["image_url"] = imageURL
		}

		if len(updates) > 0 {
			if err := db.Model(&activity).Updates(updates).Error; err != nil {
				if imageProvided {
					_ = utils.DeleteImage(cfg.UploadDir, imageURL)
				}
				utils.Fail(c, http.StatusInternalServerError, "Gagal memperbarui kegiatan")
				return
			}
		}
		if imageProvided && oldImageURL != "" && oldImageURL != imageURL {
			_ = utils.DeleteImage(cfg.UploadDir, oldImageURL)
		}

		var result models.Activity
		_ = db.First(&result, id)
		utils.OK(c, "Kegiatan diperbarui", result)
	}
}

func DeleteActivity(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 64)
		if err != nil || id == 0 {
			utils.Fail(c, http.StatusBadRequest, "ID kegiatan tidak valid")
			return
		}
		var activity models.Activity
		if err := db.First(&activity, id).Error; err != nil {
			utils.Fail(c, http.StatusNotFound, "Kegiatan tidak ditemukan")
			return
		}
		if err := db.Delete(&activity).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal menghapus kegiatan")
			return
		}
		_ = utils.DeleteImage(cfg.UploadDir, activity.ImageURL)
		utils.OK(c, "Kegiatan dihapus", nil)
	}
}
