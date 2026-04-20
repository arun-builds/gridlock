package ws

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/arun-builds/gridlock-backend/internal/auth"
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

type InitMessage struct {
	Type    string `json:"type"`
	Payload struct {
		Token  string `json:"token"`
		RoomId string `json:"roomId"`
	} `json:"payload"`
}

func ServeWs(manager *game.Manager, w http.ResponseWriter, r *http.Request) {

	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}

	_, messageBytes, err := conn.ReadMessage()

	if err != nil {
		conn.Close()
		return
	}

	var initMessage InitMessage

	if err := json.Unmarshal(messageBytes, &initMessage); err != nil || initMessage.Type != "JOIN_ROOM" {
		log.Println("Invalid handshake format. Dropping connection.")
		conn.Close()
		return
	}

	userId, nickname, err := auth.ValidateToken(initMessage.Payload.Token)
	if err != nil {
		log.Println("Unauthorized WebSocket attempt:", err)
		conn.Close()
		return
	}

	room, exists := manager.GetRoom(initMessage.Payload.RoomId)
	if !exists {
		log.Printf("Player %s tried to join invalid room %s", nickname, initMessage.Payload.RoomId)
		conn.Close()
		return
	}

	clientPtr := &models.Client{
		Id:       userId,
		Nickname: nickname,
		Conn:     conn,
		Send:     make(chan []byte, 256),
	}

	//  Send the client pointer to the Room's register channel
	// Register the verified client to the game engine
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

			var genericMessage struct {
				Type    string `json:"type"`
				Payload struct {
					X int `json:"x"`
					Y int `json:"y"`
				} `json:"payload"`
			}

			if err := json.Unmarshal(message, &genericMessage); err == nil {
				if genericMessage.Type == "TILE_INTERACT" {
					// Push the formatted action into the Game Engine channel
					room.Action <- game.PlayerAction{
						ClientId: clientPtr.Id, // The server knows exactly who this is securely
						X:        genericMessage.Payload.X,
						Y:        genericMessage.Payload.Y,
					}
				} else if genericMessage.Type == "RESET_ROOM" {
					room.Reset <- true
				}
			}

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
