package main

import (
	"log"
	"net/http"
	"os"

	"github.com/arun-builds/gridlock-backend/internal/game"
	"github.com/arun-builds/gridlock-backend/internal/ws"
	"github.com/joho/godotenv"
)

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found. Relying on system environment variables.")
	}

	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("FATAL: JWT_SECRET environment variable is not set. Server cannot start.")
	}

	port := os.Getenv("PORT")

	if port == "" {
		port = "8080" //fallback
	}

	lobby := game.NewRoom("test-lobby-1")

	go lobby.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(lobby, w, r)
	})

	log.Println("GridLock Backend running on http://localhost:8080")

	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal("Server failed to start: ", err)
	}
}
