package ws

import (
	"fmt"
	"log"
	"net/http"

	"github.com/arun-builds/gridlock-backend/internal/game"
	"github.com/arun-builds/gridlock-backend/internal/models"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // ! allowing all origins
	},
}

func ServeWs(room *game.Room, w http.ResponseWriter, r *http.Request) {

	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}

	//test user
	mockClient := models.Client{
		Id:       "dev-user-123",
		Nickname: "TestPlayer",
		Conn:     conn,
		Send:     make(chan []byte, 256),
	}
	clientPtr := &mockClient

	// 3. Send the client pointer to the Room's register channel
	room.Register <- clientPtr

	// Listens for messages from client
	go func() {
		defer func() {
			room.UnRegister <- clientPtr
		}()

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Println("Client disconnected:", err)
				break
			}
			fmt.Printf("Received payload from client: %s\n", message)

		}

	}()

	// Sends messages to client

	go func() {
		for msg := range clientPtr.Send {
			err := conn.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				break
			}
		}
	}()

}
