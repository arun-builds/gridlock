import { useState, useEffect, useRef, useCallback } from "react";

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
    grid: Record<string, Tile>; // Using a dictionary for fast lookups by "x,y"
}

export function useGameEngine(roomId: string, token: string) {
    const [gameState, setGameState] = useState<GameState>({
        status: "disconnected",
        timeRemaining: 60,
        grid: {},
    });

    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // 1. Establish connection
        setGameState((prev) => ({ ...prev, status: "connecting" }));
        const ws = new WebSocket("ws://localhost:8080/ws");
        wsRef.current = ws;

        ws.onopen = () => {
            // 2. Fire the handshake contract
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId, token }
            }));
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);

            // 3. Handle the exact JSON contracts from the Go server
            switch (message.type) {
                case "ROOM_STATE":
                    // Initial board load
                    setGameState((prev) => ({
                        ...prev,
                        status: message.payload.status,
                        timeRemaining: message.payload.timeRemaining,
                        grid: message.payload.grid || {},
                    }));
                    break;

                case "STATE_TICK":
                    // High-frequency updates during gameplay
                    setGameState((prev) => {
                        const newGrid = { ...prev.grid };
                        // Merge only the tiles that changed
                        message.payload.updates.forEach((tile: Tile) => {
                            newGrid[`${tile.x},${tile.y}`] = tile;
                        });
                        return {
                            ...prev,
                            timeRemaining: message.payload.timeRemaining,
                            grid: newGrid,
                        };
                    });
                    break;

                case "MATCH_END":
                    setGameState((prev) => ({ ...prev, status: "finished" }));
                    // In a real app, you'd also save the winner/scores to state here
                    break;
            }
        };

        ws.onclose = () => {
            setGameState((prev) => ({ ...prev, status: "disconnected" }));
        };

        return () => {
            ws.close();
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

    return { gameState, interactWithTile };
}