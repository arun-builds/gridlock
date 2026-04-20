package game

import (
	"crypto/rand"
	"math/big"
	"sync"
)

type Manager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{
		rooms: make(map[string]*Room),
	}
}

func (m *Manager) CreateRoom(width int, height int, timeLimit int) string {

	code := generateRoomCode()

	newRoom := NewRoom(code, width, height, timeLimit)

	m.mu.Lock()
	m.rooms[code] = newRoom
	m.mu.Unlock()

	go newRoom.Run()

	return code

}

func (m *Manager) GetRoom(id string) (*Room, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	room, exist := m.rooms[id]
	return room, exist
}

func (m *Manager) RemoveRoom(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.rooms, id)
}

func generateRoomCode() string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	b := make([]byte, 6)
	for i := range b {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		b[i] = letters[num.Int64()]
	}

	return string(b[0:3]) + "-" + string(b[3:6])
}
