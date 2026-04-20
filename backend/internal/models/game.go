package models

import "github.com/gorilla/websocket"

// a single authenticated WebSocket connection

type Client struct {
	Id       string
	Nickname string
	Conn     *websocket.Conn
	/*
			Send: a queue of outgoing messages for that player.
		Why Send exists (simple version):

		Many parts of the server may want to send messages.
		Instead of all writing directly to Conn (can cause conflicts), they drop messages into Send.
		One dedicated worker reads from Send and writes to Conn safely.
	*/
	Send chan []byte
}

// Tile represents a single grid square in the tug-of-war
type Tile struct {
	X         int    `json:"x"`
	Y         int    `json:"y"`
	Health    int    `json:"health"`
	OwnerID   string `json:"ownerId,omitempty"`
	Contested bool   `json:"contested"`
}

// RoomState holds the global truth for a match
type RoomState struct {
	RoomId        string          `json:"roomId"`
	Status        string          `json:"status"`
	TimeRemaining int             `json:"timeRemaining"` // "waiting", "playing", "finished"
	MaxTime       int             `json:"maxTime"`    // NEW: For when we hit Rematch
	GridWidth     int             `json:"gridWidth"`  
	GridHeight    int             `json:"gridHeight"` 
	Grid          map[string]Tile `json:"grid"`             // Internal map for fast O(1) lookups. Not sent in JSON.
}
