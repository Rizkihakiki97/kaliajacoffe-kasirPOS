package middleware

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"kaliaja.coffe/backend/internal/config"
	"kaliaja.coffe/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const TokenCookieName = "kaliaja_token"

// readSession membaca dan memvalidasi JWT. Pesan error kosong berarti sesi valid.
// Dipakai bersama oleh Auth dan OptionalAuth agar logikanya tidak diduplikasi.
func readSession(c *gin.Context, cfg *config.Config) (uint64, string, string) {
	raw, err := c.Cookie(TokenCookieName)
	if err != nil || raw == "" {
		header := c.GetHeader("Authorization")
		if strings.HasPrefix(header, "Bearer ") {
			raw = strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		}
	}
	if raw == "" {
		return 0, "", "Silakan login terlebih dahulu"
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(raw, &claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok || t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("metode tanda tangan tidak valid")
		}
		return cfg.JWTSecret, nil
	})
	if err != nil || !token.Valid {
		return 0, "", "Sesi tidak valid atau sudah kedaluwarsa"
	}

	userID, ok := claimUint(claims["sub"])
	role, roleOK := claims["role"].(string)
	if !ok || !roleOK {
		return 0, "", "Klaim sesi tidak valid"
	}
	return userID, role, ""
}

// Auth memverifikasi JWT dari cookie HttpOnly (atau header Bearer untuk keperluan API).
func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, role, message := readSession(c, cfg)
		if message != "" {
			utils.Fail(c, http.StatusUnauthorized, message)
			c.Abort()
			return
		}
		c.Set("user_id", userID)
		c.Set("role", role)
		c.Next()
	}
}

// OptionalAuth memasang identitas jika token valid, tetapi tidak menolak tamu.
// Dipakai /api/auth/session supaya frontend tidak memanggil /api/auth/me
// yang selalu menghasilkan 401 pada pengunjung belum login.
func OptionalAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, role, message := readSession(c, cfg)
		if message == "" {
			c.Set("user_id", userID)
			c.Set("role", role)
		}
		c.Next()
	}
}

// RequireRole menolak akses jika role pengguna tidak termasuk daftar yang diizinkan.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, role := range roles {
		allowed[role] = true
	}

	return func(c *gin.Context) {
		role, _ := c.Get("role")
		roleString, _ := role.(string)
		if !allowed[roleString] {
			utils.Fail(c, http.StatusForbidden, "Anda tidak memiliki akses ke sumber daya ini")
			c.Abort()
			return
		}
		c.Next()
	}
}

func CurrentUserID(c *gin.Context) (uint64, bool) {
	value, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}
	id, ok := value.(uint64)
	return id, ok
}

func CurrentRole(c *gin.Context) string {
	value, _ := c.Get("role")
	role, _ := value.(string)
	return role
}

func claimUint(value any) (uint64, bool) {
	switch v := value.(type) {
	case float64:
		if v <= 0 {
			return 0, false
		}
		return uint64(v), true
	case int64:
		if v <= 0 {
			return 0, false
		}
		return uint64(v), true
	case string:
		id, err := strconv.ParseUint(v, 10, 64)
		if err != nil || id == 0 {
			return 0, false
		}
		return id, true
	default:
		return 0, false
	}
}
