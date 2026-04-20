package game

import (
	"encoding/json"
	"fmt"
	"time"

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
	Reset      chan bool
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
			RoomId:        id,
			Status:        "waiting",
			TimeRemaining: 60,
			Grid:          make(map[string]models.Tile),
		},
		Clients:    make(map[*models.Client]bool),
		Register:   make(chan *models.Client),
		UnRegister: make(chan *models.Client),
		Broadcast:  make(chan []byte, 256),
		Action:     make(chan PlayerAction, 256),
		Reset:      make(chan bool),
	}
}

func (r *Room) Run() {

	// 1. The Game Clock: Fires every 100 milliseconds (10 frames per second)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	dirtyTiles := make(map[string]models.Tile)
	tickCount := 0

	for {
		select {
		// A new player joins the WebSocket
		case client := <-r.Register:
			r.Clients[client] = true
			fmt.Printf("Client %s joined room %s\n", client.Nickname, r.Id)
			initalState := map[string]interface{}{
				"type":    "ROOM_STATE",
				"payload": r.State,
			}

			msg, _ := json.Marshal(initalState)
			client.Send <- msg

		// a player disconnects or drop off
		case client := <-r.UnRegister:
			if _, ok := r.Clients[client]; ok {
				delete(r.Clients, client)
				close(client.Send)
				fmt.Printf("Client %s left room %s\n", client.Nickname, r.Id)
			}

		// player clicks a tile (The Tug-of-War logic )

		case action := <-r.Action:

			// Reject all clicks if the match is over
			if r.State.Status == "finished" {
				continue
			}

			if r.State.Status == "waiting" {
				r.State.Status = "playing"
			}
			// Because only this loop modifies the grid, no Mutex is needed!
			tileKey := fmt.Sprintf("%d,%d", action.X, action.Y)

			// Check if tile exists, if not create it
			tile, exists := r.State.Grid[tileKey]
			if !exists {
				// Tile is untouched. Initialize it.
				tile = models.Tile{X: action.X, Y: action.Y, Health: 100}
			}
			// Game Logic

			// Game Logic
			if tile.OwnerID != action.ClientId {
				// 1. An enemy (or neutral player) is attacking the tile
				tile.Health -= 10
				tile.Contested = true

				if tile.Health <= 0 {
					// Tile is captured!
					tile.OwnerID = action.ClientId
					tile.Health = 100
					tile.Contested = false
				}
			} else {
				// 2. The owner clicked their own tile to fortify it
				if tile.Health < 100 {
					tile.Health += 10
					if tile.Health > 100 {
						tile.Health = 100
					}
				}
				// Keep flashing/contested while reclaiming damaged territory.
				// It only becomes stable once fully fortified.
				tile.Contested = tile.Health < 100
			}

			// Save the updated tile
			r.State.Grid[tileKey] = tile
			dirtyTiles[tileKey] = tile

		case <-ticker.C:
			stateChangedThisTick := false

			if r.State.Status == "playing" {
				tickCount++
				// 10 ticks * 100ms = 1 full second
				if tickCount >= 10 {
					tickCount = 0
					r.State.TimeRemaining--
					stateChangedThisTick = true // Force a broadcast so React updates the clock
				}

				if r.State.TimeRemaining <= 0 {
					r.State.Status = "finished"

					scores := make(map[string]int)
					highestScore := 0
					winnerId := ""
					isTie := false

					for _, tile := range r.State.Grid {
						if tile.OwnerID != "" {
							scores[tile.OwnerID]++

							if scores[tile.OwnerID] > highestScore {
								highestScore = scores[tile.OwnerID]
								winnerId = tile.OwnerID
								isTie = false
							} else if scores[tile.OwnerID] == highestScore {
								isTie = true
							}

						}
					}

					if isTie {
						winnerId = "TIE"
					}

					endMsg := map[string]interface{}{
						"type": "MATCH_END",
						"payload": map[string]interface{}{
							"winnerId": winnerId,
							"scores":   scores,
						},
					}
					endMsgBytes, _ := json.Marshal(endMsg)

					for client := range r.Clients {
						select {
						case client.Send <- endMsgBytes:
						default:
							close(client.Send)
							delete(r.Clients, client)
						}
					}

				}
			}
			// Send a tick if tiles were clicked OR if the clock counted down

			if len(dirtyTiles) > 0 || stateChangedThisTick {
				// Convert the map to an array for JSON
				var updates []models.Tile
				for _, t := range dirtyTiles {
					updates = append(updates, t)
				}

				tickMessage := map[string]interface{}{
					"type": "STATE_TICK",
					"payload": map[string]interface{}{
						"status":        r.State.Status,
						"timeRemaining": r.State.TimeRemaining,
						"updates":       updates,
					},
				}

				msgBytes, _ := json.Marshal(tickMessage)

				for client := range r.Clients {
					select {
					case client.Send <- msgBytes:
					default:
						close(client.Send)
						delete(r.Clients, client)
					}
				}

				dirtyTiles = make(map[string]models.Tile)

			}

		case <-r.Reset:
			if r.State.Status == "finished" {
				// 1. Wipe the state clean
				r.State.Status = "waiting"
				r.State.TimeRemaining = 60
				r.State.Grid = make(map[string]models.Tile)
				dirtyTiles = make(map[string]models.Tile)

				// 2. Broadcast the fresh state to all connected players
				resetState := map[string]interface{}{
					"type":    "ROOM_STATE",
					"payload": r.State,
				}
				msg, _ := json.Marshal(resetState)

				for client := range r.Clients {
					select {
					case client.Send <- msg:
					default:
						close(client.Send)
						delete(r.Clients, client)
					}
				}
				fmt.Println("Room has been reset for a new match.")
			}

		// Broadcasting state updates to all connected  clients
		case message := <-r.Broadcast:
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
