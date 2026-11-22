package routes

import (
	"time"

	"kaliaja.coffe/backend/internal/config"
	"kaliaja.coffe/backend/internal/handlers"
	"kaliaja.coffe/backend/internal/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Setup(cfg *config.Config, db *gorm.DB) *gin.Engine {
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	// Jangan mempercayai header X-Forwarded-For dari sembarang klien.
	// Di produksi hanya proxy Nginx lokal yang dipercaya.
	if cfg.AppEnv == "production" {
		_ = router.SetTrustedProxies(cfg.TrustedProxies)
	} else {
		_ = router.SetTrustedProxies(nil)
	}
	router.Use(gin.Logger(), gin.Recovery())
	router.Use(middleware.SecurityHeaders())
	router.Use(middleware.MaxBody(cfg.MaxUploadByte))
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.AllowedOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check untuk Render / load balancer. Tidak perlu database agar
	// tetap merespons walau DB sedang gangguan (platform bisa restart service).
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	router.Static("/uploads", cfg.UploadDir)

	api := router.Group("/api")
	authLimiter := middleware.NewRateLimiter(5, 5.0/60.0).Middleware()

	auth := api.Group("/auth")
	// Rate limiter hanya untuk endpoint yang rawan brute force. Jangan pasang
	// pada /auth/session maupun /auth/me: keduanya dipanggil saat bootstrap UI
	// sehingga token bucket bisa habis dan sesi valid ikut kena 429.
	auth.POST("/register", authLimiter, handlers.Register(db))
	auth.POST("/login", authLimiter, handlers.Login(cfg, db))
	auth.POST("/forgot-password", authLimiter, handlers.ForgotPassword(cfg, db))
	auth.POST("/reset-password", authLimiter, handlers.ResetPassword(db))
	// Bootstrap sesi untuk frontend: 200 untuk tamu maupun user login.
	// /auth/me tetap dipertahankan untuk keperluan API dan pengujian RBAC.
	auth.GET("/session", middleware.OptionalAuth(cfg), handlers.Session(db))
	auth.GET("/me", middleware.Auth(cfg), handlers.Me(db))
	auth.POST("/logout", middleware.Auth(cfg), handlers.Logout(cfg))

	// Endpoint publik
	api.GET("/branding", handlers.GetBranding(db))
	api.GET("/categories", handlers.ListCategories(db))
	api.GET("/products", handlers.ListProducts(db))
	api.GET("/activities", handlers.ListActivities(db))

	// Endpoint terproteksi: verifikasi token dulu, lalu role di sisi server.
	protected := api.Group("")
	protected.Use(middleware.Auth(cfg))
	{
		protected.PUT("/branding", middleware.RequireRole("bos"), handlers.UpdateBranding(cfg, db))

		protected.POST("/products", middleware.RequireRole("admin"), handlers.CreateProduct(cfg, db))
		protected.PUT("/products/:id", middleware.RequireRole("admin"), handlers.UpdateProduct(cfg, db))
		protected.DELETE("/products/:id", middleware.RequireRole("admin"), handlers.DeleteProduct(cfg, db))

		protected.POST("/activities", middleware.RequireRole("admin"), handlers.CreateActivity(cfg, db))
		protected.PUT("/activities/:id", middleware.RequireRole("admin"), handlers.UpdateActivity(cfg, db))
		protected.DELETE("/activities/:id", middleware.RequireRole("admin"), handlers.DeleteActivity(cfg, db))

		protected.GET("/transactions", middleware.RequireRole("admin"), handlers.AdminListTransactions(db))
		protected.POST("/transactions/pos", middleware.RequireRole("admin"), handlers.CreatePOS(db))
		protected.POST("/transactions/order", middleware.RequireRole("customer"), handlers.CreateOrder(db))
		protected.POST("/transactions/:id/receipt", middleware.RequireRole("admin"), handlers.UploadReceipt(cfg, db))
		protected.DELETE("/transactions/:id/receipt", middleware.RequireRole("admin"), handlers.DeleteReceipt(cfg, db))

		protected.GET("/bos/transactions", middleware.RequireRole("bos"), handlers.BOSListTransactions(db))
		protected.GET("/bos/stocks", middleware.RequireRole("bos"), handlers.BOSListStocks(db))
	}

	return router
}
