# GridLock

Real-time multiplayer territory control game with a Go backend and React frontend.

## Stack

- Backend: Go, Gorilla WebSocket, JWT auth
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Transport: HTTP for room/join flow, WebSocket for live match state

## Monorepo Structure

- `backend/` - API server, room manager, game engine, WebSocket gateway
- `client/` - lobby, game UI, real-time game hook

## Features

- Create private rooms with custom settings:
  - Grid width
  - Grid height
  - Match time limit
- Join rooms using room code (format: `ABC-DEF`)
- Real-time grid updates over WebSocket
- Tile combat and fortification mechanics
- Match-end winner/tie scoring screen
- In-match rematch/reset flow
- Persistent local nickname in browser `localStorage`

## Prerequisites

- Go 1.22+ (or compatible with this codebase)
- Node.js 18+ and `pnpm`

## Setup

### 1) Backend

```bash
cd backend
cp .env.example .env  # if you have an example file
```

Set required env vars in `backend/.env`:

```env
JWT_SECRET=your-secret
PORT=8080
```

Run backend:

```bash
go run cmd/server/main.go
```

Server starts on: `http://localhost:8080`

### 2) Frontend

```bash
cd client
pnpm install
pnpm dev
```

Frontend starts on: `http://localhost:5173`

## API Contract (Current)

### `POST /api/rooms`

Creates a new room.

Request body (optional, defaults are applied server-side):

```json
{
  "width": 20,
  "height": 20,
  "timeLimit": 60
}
```

Response:

```json
{
  "roomId": "ABC-DEF"
}
```

### `POST /api/join`

Validates room and returns a JWT session token.

Request:

```json
{
  "nickname": "PlayerOne",
  "roomId": "ABC-DEF"
}
```

Response:

```json
{
  "token": "<jwt>"
}
```

### `GET /ws` (WebSocket upgrade)

Client sends initial handshake message:

```json
{
  "type": "JOIN_ROOM",
  "payload": {
    "token": "<jwt>",
    "roomId": "ABC-DEF"
  }
}
```

Runtime messages:

- Client -> server
  - `TILE_INTERACT` with `{ x, y }`
  - `RESET_ROOM`
- Server -> client
  - `ROOM_STATE`
  - `STATE_TICK`
  - `MATCH_END`

## Gameplay Notes

- Clicking an enemy/neutral tile attacks it.
- Clicking your own damaged tile fortifies it.
- A damaged owned tile remains contested (flashing) until health returns to 100.
- When timer reaches zero, scores are computed by owned tile count.

## Troubleshooting

- CORS errors from frontend:
  - Ensure backend is running with latest code.
  - Restart backend after server code changes.
- Immediate `disconnected` status:
  - Confirm WebSocket handshake includes both `token` and `roomId`.
  - Ensure room code exists before joining.
- Room join fails with 404:
  - Verify room code format and that the room has not expired/been removed.

## Development Tips

- Run backend checks:

```bash
cd backend
go test ./...
```

- Run frontend:

```bash
cd client
pnpm dev
```

