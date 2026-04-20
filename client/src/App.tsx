import { useState } from "react";
import GameRoom from "./components/GameRoom";

export default function App() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  
  const [token, setToken] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Flow 1: Player clicks "Create Private Match"
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!nickname.trim()) return setError("Please enter an alias first.");
    
    setIsLoading(true);
    try {
      // 1. Ask Go to spin up a new Mutex-locked room
      const roomRes = await fetch("http://localhost:8080/api/rooms", { method: "POST" });
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
    const joinRes = await fetch("http://localhost:8080/api/join", {
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
              disabled={isLoading || roomCode.length < 6}
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