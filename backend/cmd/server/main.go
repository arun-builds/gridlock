package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/arun-builds/gridlock-backend/internal/auth"
	"github.com/arun-builds/gridlock-backend/internal/game"
	"github.com/arun-builds/gridlock-backend/internal/ws"
	"github.com/joho/godotenv"
)

func resolveAllowedOrigin(appEnv string) string {
	allowedOrigin := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/")
	if allowedOrigin == "" {
		if appEnv == "production" {
			log.Fatal("FATAL: FRONTEND_URL must be set in production to prevent CORS vulnerabilities.")
		}
		log.Println("Notice: FRONTEND_URL not set. Defaulting to local React port for development.")
		allowedOrigin = "http://localhost:5173"
	}
	return allowedOrigin
}

func corsMiddleware(next http.Handler, allowedOrigin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Vary", "Origin")
			if origin != allowedOrigin {
				http.Error(w, "CORS origin not allowed", http.StatusForbidden)
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {

	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found. Relying on system environment variables.")
	}

	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("FATAL: JWT_SECRET environment variable is not set. Server cannot start.")
	}

	appEnv := os.Getenv("APP_ENV")
	allowedOrigin := resolveAllowedOrigin(appEnv)

	port := os.Getenv("PORT")

	if port == "" {
		port = "8080" //fallback
	}

	manager := game.NewManager()

	mux := http.NewServeMux()

	mux.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var settings struct {
			Width     int `json:"width"`
			Height    int `json:"height"`
			TimeLimit int `json:"timeLimit"`
		}
		json.NewDecoder(r.Body).Decode(&settings)

		// Set defaults
		if settings.Width == 0 {
			settings.Width = 8
		}
		if settings.Height == 0 {
			settings.Height = 8
		}
		if settings.TimeLimit == 0 {
			settings.TimeLimit = 60
		}

		roomCode := manager.CreateRoom(settings.Width, settings.Height, settings.TimeLimit)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"roomId": roomCode,
		})
	})

	mux.HandleFunc("/api/join", func(w http.ResponseWriter, r *http.Request) {

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
		if !exists {
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

	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(manager, w, r)
	})

	log.Println("GridLock Backend running on http://localhost:" + port)

	err := http.ListenAndServe(":"+port, corsMiddleware(mux, allowedOrigin))
	if err != nil {
		log.Fatal("Server failed to start: ", err)
	}
}
