package seed

import (
	"log"

	"kaliaja.coffe/backend/internal/config"
	"kaliaja.coffe/backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Run membuat akun admin & bos awal, kategori, dan baris branding jika belum ada.
// Dijalankan manual: go run ./cmd/server -seed
func Run(db *gorm.DB, cfg *config.Config) {
	if cfg.AppEnv == "production" && (cfg.SeedAdminPassword == "Admin123!" || cfg.SeedBOSPassword == "Bos123!") {
		log.Fatal("SEED_ADMIN_PASSWORD dan SEED_BOS_PASSWORD wajib diganti sebelum seeding di production")
	}

	ensureUser(db, "Administrator", cfg.SeedAdminEmail, cfg.SeedAdminPassword, models.RoleAdmin)
	ensureUser(db, "BOS", cfg.SeedBOSEmail, cfg.SeedBOSPassword, models.RoleBOS)

	categories := []string{"Coffee", "Non-Coffee", "Snack"}
	slugs := []string{"coffee", "non-coffee", "snack"}
	for index, name := range categories {
		category := models.Category{Name: name, Slug: slugs[index]}
		if err := db.Where("slug = ?", category.Slug).FirstOrCreate(&category).Error; err != nil {
			log.Printf("gagal menyiapkan kategori %s: %v", name, err)
		}
	}

	branding := models.Branding{ID: 1}
	if err := db.FirstOrCreate(&branding, models.Branding{ID: 1}).Error; err != nil {
		log.Printf("gagal menyiapkan branding: %v", err)
		return
	}
	if branding.BrandName == "" {
		_ = db.Model(&branding).Update("brand_name", "Kaliaja.coffe")
	}

	log.Println("seed selesai")
}

func ensureUser(db *gorm.DB, name, email, password string, role models.Role) {
	var count int64
	if err := db.Model(&models.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		log.Printf("gagal mengecek akun %s: %v", email, err)
		return
	}
	if count > 0 {
		log.Printf("akun %s sudah ada, dilewati", email)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		log.Printf("gagal menghash password %s: %v", email, err)
		return
	}
	user := models.User{
		Name:         name,
		Email:        email,
		PasswordHash: string(hash),
		Role:         role,
	}
	if err := db.Create(&user).Error; err != nil {
		log.Printf("gagal membuat akun %s: %v", email, err)
		return
	}
	log.Printf("akun %s (%s) dibuat", email, role)
}
