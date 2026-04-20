import { useState } from "react";
import GameRoom from "./components/GameRoom";

export default function App() {
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nickname.trim()) {
      setError("Please enter a nickname.");
      return;
    }

    setIsJoining(true);

    try {
      // Hit your Go server
      const response = await fetch("http://localhost:8080/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });

      if (!response.ok) throw new Error("Failed to join the server.");

      const data = await response.json();
      setToken(data.token);
    } catch (err) {
      setError("Could not connect to the GridLock backend.");
      console.error(err);
    } finally {
      setIsJoining(false);
    }
  };

  // If we have a token, mount the game!
  if (token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white p-4">
        <GameRoom token={token} />
      </main>
    );
  }

  // Otherwise, show the Lobby
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white p-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black tracking-tighter mb-2">GridLock</h1>
          <p className="text-zinc-400">High-speed tactical territory control.</p>
        </div>

        <form onSubmit={handleJoinLobby} className="flex flex-col gap-4">
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-zinc-400 mb-1">
              Choose your alias
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. DevKing"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={15}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isJoining}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-3 rounded-lg transition-colors mt-2"
          >
            {isJoining ? "Connecting..." : "Deploy to Grid"}
          </button>
        </form>
      </div>
    </main>
  );
}