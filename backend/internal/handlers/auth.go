package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"net/smtp"
	"strings"
	"time"

	"kaliaja.coffe/backend/internal/config"
	"kaliaja.coffe/backend/internal/middleware"
	"kaliaja.coffe/backend/internal/models"
	"kaliaja.coffe/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const bcryptCost = 12

type registerInput struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type forgotInput struct {
	Email string `json:"email"`
}

type resetInput struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type userResponse struct {
	ID       uint64      `json:"id"`
	Name     string      `json:"name"`
	Email    string      `json:"email"`
	Role     models.Role `json:"role"`
	Redirect string      `json:"redirect"`
}

func Register(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input registerInput
		if err := c.ShouldBindJSON(&input); err != nil {
			utils.Fail(c, http.StatusBadRequest, "Data registrasi tidak valid")
			return
		}

		input.Name = strings.TrimSpace(input.Name)
		input.Email = strings.ToLower(strings.TrimSpace(input.Email))
		if input.Name == "" || len(input.Name) < 2 {
			utils.Fail(c, http.StatusBadRequest, "Nama minimal 2 karakter")
			return
		}
		address, err := mail.ParseAddress(input.Email)
		if err != nil || !strings.EqualFold(address.Address, input.Email) {
			utils.Fail(c, http.StatusBadRequest, "Format email tidak valid")
			return
		}
		if len(input.Password) < 8 {
			utils.Fail(c, http.StatusBadRequest, "Password minimal 8 karakter")
			return
		}

		var count int64
		if err := db.Model(&models.User{}).Where("email = ?", input.Email).Count(&count).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal memeriksa email")
			return
		}
		if count > 0 {
			utils.Fail(c, http.StatusConflict, "Email sudah terdaftar")
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcryptCost)
		if err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal mengamankan password")
			return
		}

		user := models.User{
			Name:         input.Name,
			Email:        input.Email,
			PasswordHash: string(hash),
			Role:         models.RoleCustomer,
		}
		if err := db.Create(&user).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal membuat akun")
			return
		}

		utils.Created(c, "Registrasi berhasil", toUserResponse(user))
	}
}

func Login(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input loginInput
		if err := c.ShouldBindJSON(&input); err != nil {
			utils.Fail(c, http.StatusBadRequest, "Data login tidak valid")
			return
		}
		input.Email = strings.ToLower(strings.TrimSpace(input.Email))

		var user models.User
		err := db.Where("email = ?", input.Email).First(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.Fail(c, http.StatusUnauthorized, "Email atau password salah")
			return
		}
		if err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal memproses login")
			return
		}
		if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)) != nil {
			utils.Fail(c, http.StatusUnauthorized, "Email atau password salah")
			return
		}

		token, err := generateToken(cfg, user)
		if err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal membuat sesi")
			return
		}

		c.SetSameSite(http.SameSiteStrictMode)
		c.SetCookie(
			middleware.TokenCookieName,
			token,
			int(cfg.JWTExpiry.Seconds()),
			"/",
			"",
			cfg.CookieSecure,
			true, // HttpOnly
		)

		utils.OK(c, "Login berhasil", toUserResponse(user))
	}
}

func Logout(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.SetSameSite(http.SameSiteStrictMode)
		c.SetCookie(middleware.TokenCookieName, "", -1, "/", "", cfg.CookieSecure, true)
		utils.OK(c, "Logout berhasil", nil)
	}
}

func Me(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := middleware.CurrentUserID(c)
		if !ok {
			utils.Fail(c, http.StatusUnauthorized, "Sesi tidak valid")
			return
		}
		var user models.User
		if err := db.First(&user, id).Error; err != nil {
			utils.Fail(c, http.StatusUnauthorized, "Akun tidak ditemukan")
			return
		}
		utils.OK(c, "Data akun", toUserResponse(user))
	}
}

// Session berguna untuk bootstrap frontend. Endpoint ini selalu 200, baik untuk
// tamu maupun pengguna login, sehingga Network tab tidak dipenuhi error 401.
func Session(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := middleware.CurrentUserID(c)
		if !ok {
			utils.OK(c, "Sesi tamu", gin.H{"user": nil})
			return
		}
		var user models.User
		if err := db.First(&user, id).Error; err != nil {
			utils.OK(c, "Sesi tamu", gin.H{"user": nil})
			return
		}
		utils.OK(c, "Data sesi", gin.H{"user": toUserResponse(user)})
	}
}

func ForgotPassword(cfg *config.Config, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input forgotInput
		if err := c.ShouldBindJSON(&input); err != nil {
			utils.Fail(c, http.StatusBadRequest, "Data tidak valid")
			return
		}
		email := strings.ToLower(strings.TrimSpace(input.Email))

		var user models.User
		err := db.Where("email = ?", email).First(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Balasan generik untuk mencegah enumerasi akun.
			utils.OK(c, "Jika email terdaftar, tautan reset password telah dikirim", nil)
			return
		}
		if err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal memproses permintaan")
			return
		}

		rawToken := make([]byte, 32)
		if _, err := rand.Read(rawToken); err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal membuat token")
			return
		}
		raw := hex.EncodeToString(rawToken)
		stored := hashToken(raw)
		expires := time.Now().Add(15 * time.Minute)

		if err := db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]any{
			"reset_token":            stored,
			"reset_token_expires_at": expires,
		}).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal menyimpan token reset")
			return
		}

		link := cfg.AppURL + "/reset-password?token=" + raw
		body := "Halo " + user.Name + ",\n\nGunakan tautan berikut untuk mereset password Anda (berlaku 15 menit):\n" + link + "\n\nJika ini bukan Anda, abaikan email ini.\n"
		if err := sendMail(cfg, user.Email, "Reset Password Kaliaja.coffe", body); err != nil {
			log.Printf("gagal mengirim email reset ke %s: %v", user.Email, err)
		}

		utils.OK(c, "Jika email terdaftar, tautan reset password telah dikirim", nil)
	}
}

func ResetPassword(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input resetInput
		if err := c.ShouldBindJSON(&input); err != nil {
			utils.Fail(c, http.StatusBadRequest, "Data tidak valid")
			return
		}
		if len(input.Password) < 8 {
			utils.Fail(c, http.StatusBadRequest, "Password minimal 8 karakter")
			return
		}

		var user models.User
		err := db.Where("reset_token = ? AND reset_token_expires_at > ?", hashToken(input.Token), time.Now()).First(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.Fail(c, http.StatusBadRequest, "Token reset tidak valid atau sudah kedaluwarsa")
			return
		}
		if err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal memverifikasi token")
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcryptCost)
		if err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal mengamankan password")
			return
		}
		if err := db.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]any{
			"password_hash":          string(hash),
			"reset_token":            nil,
			"reset_token_expires_at": nil,
		}).Error; err != nil {
			utils.Fail(c, http.StatusInternalServerError, "Gagal menyimpan password baru")
			return
		}

		utils.OK(c, "Password berhasil diperbarui. Silakan login kembali.", nil)
	}
}

func generateToken(cfg *config.Config, user models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":  user.ID,
		"role": string(user.Role),
		"jti":  uuid.NewString(),
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(cfg.JWTExpiry).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(cfg.JWTSecret)
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func toUserResponse(user models.User) userResponse {
	return userResponse{
		ID:       user.ID,
		Name:     user.Name,
		Email:    user.Email,
		Role:     user.Role,
		Redirect: redirectFor(user.Role),
	}
}

func redirectFor(role models.Role) string {
	switch role {
	case models.RoleAdmin:
		return "/admin"
	case models.RoleBOS:
		return "/bos"
	default:
		return "/"
	}
}

func sendMail(cfg *config.Config, to, subject, body string) error {
	if cfg.SMTPHost == "" {
		// Di produksi token reset tidak boleh bocor ke log server.
		if cfg.AppEnv == "production" {
			return errors.New("SMTP belum dikonfigurasi")
		}
		log.Printf("[DEV-ONLY] Reset password untuk %s: %s", to, body)
		return nil
	}
	message := "From: " + cfg.SMTPFrom + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n\r\n" + body
	auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)
	return smtp.SendMail(cfg.SMTPHost+":"+cfg.SMTPPort, auth, cfg.SMTPFrom, []string{to}, []byte(message))
}
