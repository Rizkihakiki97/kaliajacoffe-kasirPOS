package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"kaliaja.coffe/backend/internal/config"
	"kaliaja.coffe/backend/internal/database"
	"kaliaja.coffe/backend/internal/routes"
	"kaliaja.coffe/backend/internal/seed"
	"kaliaja.coffe/backend/internal/utils"
)

func main() {
	seedOnly := flag.Bool("seed", false, "isi akun dan data awal lalu keluar")
	flag.Parse()

	cfg := config.Load()
	utils.ConfigureStorage(utils.StorageSettings{
		Driver:         cfg.StorageDriver,
		CloudName:      cfg.CloudName,
		CloudAPIKey:    cfg.CloudAPIKey,
		CloudAPISecret: cfg.CloudAPISecret,
		CloudFolder:    cfg.CloudFolder,
	})
	db := database.Connect(cfg)

	if *seedOnly {
		seed.Run(db, cfg)
		return
	}

	router := routes.Setup(cfg, db)
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("gagal menghentikan server dengan anggun: %v", err)
		}
	}()

	log.Printf("Kaliaja.coffe API berjalan di http://localhost:%s", cfg.Port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
	log.Println("Kaliaja.coffe API berhenti")
}
