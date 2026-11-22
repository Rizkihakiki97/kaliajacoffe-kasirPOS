package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"kaliaja.coffe/backend/internal/utils"
)

// SecurityHeaders menambah header dasar pengaman response.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		c.Next()
	}
}

// MaxBody membatasi ukuran request body (termasuk multipart/upload).
func MaxBody(limit int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}

type visitor struct {
	tokens float64
	last   time.Time
}

// RateLimiter: token bucket sederhana per IP, cocok untuk endpoint auth.
type RateLimiter struct {
	mu        sync.Mutex
	visitors  map[string]*visitor
	capacity  float64
	refillPS  float64
	cleanupAt time.Time
}

func NewRateLimiter(capacity int, refillPerSecond float64) *RateLimiter {
	return &RateLimiter{
		visitors:  make(map[string]*visitor),
		capacity:  float64(capacity),
		refillPS:  refillPerSecond,
		cleanupAt: time.Now().Add(time.Hour),
	}
}

func (l *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		l.mu.Lock()
		v, exists := l.visitors[ip]
		if !exists {
			v = &visitor{tokens: l.capacity, last: now}
			l.visitors[ip] = v
		}
		elapsed := now.Sub(v.last).Seconds()
		if elapsed > 0 {
			v.tokens += elapsed * l.refillPS
			if v.tokens > l.capacity {
				v.tokens = l.capacity
			}
			v.last = now
		}

		allowed := v.tokens >= 1
		if allowed {
			v.tokens--
		}

		if now.After(l.cleanupAt) {
			for key, item := range l.visitors {
				if now.Sub(item.last) > time.Hour {
					delete(l.visitors, key)
				}
			}
			l.cleanupAt = now.Add(time.Hour)
		}
		l.mu.Unlock()

		if !allowed {
			utils.Fail(c, http.StatusTooManyRequests, "Terlalu banyak percobaan. Silakan coba lagi beberapa saat.")
			c.Abort()
			return
		}
		c.Next()
	}
}
