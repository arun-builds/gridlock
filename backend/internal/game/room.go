package game

import (
	"fmt"

	"github.com/arun-builds/gridlock-backend/internal/models"
)

type Room struct {
	Id string

	// current state of the game
	State *models.RoomState

	Clients map[*models.Client]bool

	// channels for concurrent event processing
	Register   chan *models.Client
	UnRegister chan *models.Client
	Broadcast  chan []byte
	Action     chan PlayerAction // Custom struct for tile clicks

}

// incoming move from client
type PlayerAction struct {
	ClientId string
	X        int
	Y        int
}


// creates a new instance of a room and returns a pointer to it.

func NewRoom(id string) *Room {
	return &Room{
		Id: id,
		State: &models.RoomState{
			RoomId: id,
			Status: "waiting",
			TimeRemaining: 60,
			Grid: make(map[string]models.Tile),
		},
		Clients: make(map[*models.Client]bool),
		Register:   make(chan *models.Client),
		UnRegister: make(chan *models.Client),
		Broadcast:  make(chan []byte, 256),
		Action:     make(chan PlayerAction, 256),
	}
}


func (r *Room) Run() {
	for {
		select{
			// A new player joins the WebSocket
		case client := <- r.Register:
			r.Clients[client] = true
			fmt.Printf("Client %s joined room %s\n", client.Nickname, r.Id)

		// a player disconnects or drop off
		case client := <- r.UnRegister:
			if _, ok := r.Clients[client]; ok {
				delete(r.Clients, client)
				close(client.Send)
				fmt.Printf("Client %s left room %s\n", client.Nickname, r.Id)
			}
		
		// player clicks a tile (The Tug-of-War logic )

		case action := <- r.Action:
			// Because only this loop modifies the grid, no Mutex is needed!
			tileKey := fmt.Sprintf("%d,%d", action.X, action.Y)

			// Check if tile exists, if not create it
			tile, exists := r.State.Grid[tileKey]
			if !exists {
				tile = models.Tile{X: action.X, Y: action.Y, Health: 100}
			}
			// TODO: Process the health drain logic and assign Karma/Points

			r.State.Grid[tileKey] = tile

		// Broadcasting state updates to all connected  clients
		case message := <- r.Broadcast:
			for client := range r.Clients {
				select {
				case client.Send <- message:
				default:
					// If the client's send buffer is full, they are a dead connection. Boot them.
					close(client.Send)
					delete(r.Clients, client)
				}
			}
		}

		
	
	}
}