import { useState, useEffect, useRef, useCallback } from "react";

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

// These interfaces match the Go structs exactly
export interface Tile {
    x: number;
    y: number;
    health: number;
    ownerId?: string;
    contested: boolean;
}

export interface GameState {
    status: "disconnected" | "connecting" | "waiting" | "playing" | "finished";
    timeRemaining: number;
    maxTime: number;
    gridWidth: number;
    gridHeight: number;
    grid: Record<string, Tile>; // Using a dictionary for fast lookups by "x,y"
    winnerId?: string;                     
    scores?: Record<string, number>;       
}

export function useGameEngine(roomId: string, token: string) {
    const [gameState, setGameState] = useState<GameState>({
        status: "disconnected",
        timeRemaining: 60,
        maxTime: 60,
        gridWidth: 20,
        gridHeight: 20,
        grid: {},
    });

    const [localUserId, setLocalUserId] = useState<string>("");

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {

        try {
            const payloadBase64 = token.split(".")[1];
            const payloadJson = JSON.parse(atob(payloadBase64));
            setLocalUserId(payloadJson.userId);
        } catch (err) {
            console.error("Failed to decode token", err);
        }

        setGameState((prev) => ({ ...prev, status: "connecting" }));
        const ws = new WebSocket(`${backendUrl}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {

            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { token, roomId }
            }));
        };

        ws.onmessage = (event) => {
            let message: any;
            try {
                message = JSON.parse(event.data);
            } catch (err) {
                console.warn("Ignoring non-JSON WebSocket message", err);
                return;
            }

            // 3. Handle the exact JSON contracts from the Go server
            switch (message.type) {
                case "ROOM_STATE":
                    // Initial board load
                    setGameState((prev) => ({
                        ...prev,
                        status: message.payload.status,
                        timeRemaining: message.payload.timeRemaining,
                        maxTime: message.payload.maxTime ?? prev.maxTime,
                        gridWidth: message.payload.gridWidth ?? prev.gridWidth,
                        gridHeight: message.payload.gridHeight ?? prev.gridHeight,
                        grid: message.payload.grid || {},
                        winnerId: undefined,
                        scores: undefined,
                    }));
                    break;

                case "STATE_TICK":
                    // High-frequency updates during gameplay
                    setGameState((prev) => {
                        const newGrid = { ...prev.grid };
                        const payload = message?.payload ?? {};
                        const updates: Tile[] = Array.isArray(payload.updates) ? payload.updates : [];
                        // Merge only the tiles that changed
                        updates.forEach((tile: Tile) => {
                            newGrid[`${tile.x},${tile.y}`] = tile;
                        });
                        return {
                            ...prev,
                            status: payload.status || prev.status,
                            timeRemaining: typeof payload.timeRemaining === "number" ? payload.timeRemaining : prev.timeRemaining,
                            grid: newGrid,
                            ...(payload.status === "finished"
                                ? {}
                                : { winnerId: undefined, scores: undefined }),
                        };
                    });
                    break;

                case "MATCH_END":
                    setGameState((prev) => ({
                        ...prev,
                        status: "finished",
                        winnerId: message.payload.winnerId,
                        scores: message.payload.scores,
                    }));
                    break;
                default:
                    break;
            }
        };

        ws.onclose = () => {
            setGameState((prev) => ({ ...prev, status: "disconnected" }));
        };

        return () => {
            ws.onopen = null;
            ws.onmessage = null;
            ws.onclose = null;

            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, "component unmounted");
            }
        };
    }, [roomId, token]);

    // 4. Expose a clean function for components to trigger moves
    const interactWithTile = useCallback((x: number, y: number) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "TILE_INTERACT",
                payload: { x, y }
            }));
        }
    }, []);

    const resetGame = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "RESET_ROOM"
            }));
        }
    }, []);

    return { gameState, interactWithTile, resetGame, localUserId };
}