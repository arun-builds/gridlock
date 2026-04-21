import { useEffect, useState } from "react";
import GameRoom from "./components/GameRoom";

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

export default function App() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [gridWidth, setGridWidth] = useState(20);
  const [gridHeight, setGridHeight] = useState(20);
  const [timeLimit, setTimeLimit] = useState(60);
  
  const [token, setToken] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // NEW: Load the saved name when the app opens
  useEffect(() => {
    const savedName = localStorage.getItem("gridlock_commander");
    if (savedName) setNickname(savedName);
  }, []);

  // Flow 1: Player clicks "Create Private Match"
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!nickname.trim()) return setError("Please enter an alias first.");

    // NEW: Save the name for next time
    localStorage.setItem("gridlock_commander", nickname.trim());
    
    setIsLoading(true);
    try {
      // 1. Ask Go to spin up a new Mutex-locked room
      const roomRes = await fetch(`${backendUrl}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: gridWidth,
          height: gridHeight,
          timeLimit,
        }),
      });
      if (!roomRes.ok) throw new Error("Failed to initialize server.");
      
      const roomData = await roomRes.json();
      
      // 2. Immediately join the room we just created
      await executeJoin(nickname, roomData.roomId);
    } catch (err: any) {
      setError(err.message || "Server error creating room.");
    } finally {
      setIsLoading(false);
    }
  };

  // Flow 2: Player clicks "Join Match"
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!nickname.trim()) return setError("Please enter an alias.");
    if (!roomCode.trim()) return setError("Please enter a 6-letter room code.");

    // NEW: Save the name for next time
    localStorage.setItem("gridlock_commander", nickname.trim());
    
    setIsLoading(true);
    try {
      await executeJoin(nickname, roomCode.toUpperCase());
    } catch (err: any) {
      setError(err.message || "Could not connect to the backend.");
    } finally {
      setIsLoading(false);
    }
  };

  // The actual HTTP handshake to get the JWT
  const executeJoin = async (name: string, id: string) => {
    const joinRes = await fetch(`${backendUrl}/api/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: name, roomId: id }),
    });

    if (!joinRes.ok) {
      if (joinRes.status === 404) throw new Error(`Room ${id} not found or expired.`);
      throw new Error("Failed to join room.");
    }

    const joinData = await joinRes.json();
    setToken(joinData.token);
    setActiveRoomId(id);
  };

  // If we successfully got a token and room code, mount the game!
  if (token && activeRoomId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white p-4">
        {/* Pass the dynamic roomId down to the game board */}
        <GameRoom token={token} roomId={activeRoomId} />
      </main>
    );
  }

  // The Matchmaker UI
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white p-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black tracking-tighter mb-2">GridLock</h1>
          <p className="text-zinc-400">Tactical territory control.</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-400 mb-1">Commander Alias</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. DevKing"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={15}
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

        <div className="flex flex-col gap-4">
          <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 uppercase tracking-wider">Width</label>
                <input
                  type="number"
                  min={8}
                  max={50}
                  value={gridWidth}
                  onChange={(e) => setGridWidth(Math.max(8, Math.min(50, Number(e.target.value) || 20)))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-white text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 uppercase tracking-wider">Height</label>
                <input
                  type="number"
                  min={8}
                  max={50}
                  value={gridHeight}
                  onChange={(e) => setGridHeight(Math.max(8, Math.min(50, Number(e.target.value) || 20)))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-white text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 uppercase tracking-wider">Time</label>
                <input
                  type="number"
                  min={15}
                  max={600}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Math.max(15, Math.min(600, Number(e.target.value) || 60)))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-white text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Create Private Match
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="grow border-t border-zinc-800"></div>
            <span className="shrink-0 mx-4 text-zinc-600 text-sm font-bold uppercase">Or</span>
            <div className="grow border-t border-zinc-800"></div>
          </div>

          <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="CODE (e.g. ABC-DEF)"
              className="w-2/3 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase tracking-widest"
              maxLength={7}
            />
             <button
              onClick={handleJoinRoom}
              disabled={isLoading || roomCode.length < 7}
              className="w-1/3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}