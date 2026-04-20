"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("Disconnected");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 1. Open the WebSocket connection
    const ws = new WebSocket("ws://localhost:8080/ws");
    wsRef.current = ws;

    // 2. Handle connection open
    ws.onopen = () => {
      setStatus("Connected");
      console.log("Successfully connected to Go backend.");

      // Fire our first test contract payload
      const testPayload = {
        type: "JOIN_ROOM",
        payload: { roomId: "test-lobby-1", token: "mock-jwt" }
      };
      ws.send(JSON.stringify(testPayload));
    };

    // 3. Handle incoming messages from Go
    ws.onmessage = (event) => {
      console.log("Message from server:", event.data);
    };

    // 4. Handle disconnection
    ws.onclose = () => {
      setStatus("Disconnected");
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-950 text-white">
      <h1 className="text-4xl font-bold mb-4">GridLock Engine Test</h1>

      <div className="flex items-center gap-2">
        <span className="text-lg">Status:</span>
        <span className={`font-mono px-3 py-1 rounded ${status === 'Connected' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {status}
        </span>
      </div>

      <button
        className="mt-8 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
        onClick={() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: "TILE_INTERACT",
              payload: { x: 5, y: 10 }
            }));
          }
        }}
      >
        Send Test Click
      </button>
    </main>
  );
}