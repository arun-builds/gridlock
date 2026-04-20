package main

import (
	"log"
	"net/http"

	"github.com/arun-builds/gridlock-backend/internal/game"
	"github.com/arun-builds/gridlock-backend/internal/ws"
)

func main() {
	lobby := game.NewRoom("test-lobby-1")

	go lobby.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWs(lobby, w, r)
	})

	log.Println("GridLock Backend running on http://localhost:8080")

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("Server failed to start: ", err)
	}
}
