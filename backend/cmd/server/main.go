package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/arun-builds/gridlock-backend/internal/auth"
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

	manager := game.NewManager()

	http.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		// The Manager locks memory, spins up the goroutine, and returns the code
		roomCode := manager.CreateRoom()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"roomId": roomCode,
		})
	})

	http.HandleFunc("/api/join", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var requestBody struct {
			Nickname string `json:"nickname"`
			RoomId   string `json:"roomId"`
		}

		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil || requestBody.Nickname == "" {
			http.Error(w, "Invalid Request, Nickname & RoomId is required ", http.StatusBadRequest)
			return
		}

		_, exists := manager.GetRoom(requestBody.RoomId)
		if !exists{
			http.Error(w, "Room not found or has expired", http.StatusNotFound)
			return
		}

		tokenString, err := auth.GenerateGuestToken(requestBody.Nickname)
		if err != nil {
			http.Error(w, "Failed to generate session", http.StatusInternalServerError)
			return
		}



		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"token": tokenString,
		})

	})

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(manager, w, r)
	})

	log.Println("GridLock Backend running on http://localhost:" + port)

	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal("Server failed to start: ", err)
	}
}
