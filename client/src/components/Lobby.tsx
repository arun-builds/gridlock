import { useEffect, useState } from "react";
import { GridMark } from "./GridMark";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

interface LobbyProps {
  onJoined: (token: string, roomId: string) => void;
}

type Mode = "create" | "join";

export default function Lobby({ onJoined }: LobbyProps) {
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState<Mode>("create");

  const [roomCode, setRoomCode] = useState("");
  const [boardSize, setBoardSize] = useState(8);
  const [timeLimit, setTimeLimit] = useState(60);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem("gridlock_commander");
    if (savedName) setNickname(savedName);
  }, []);

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
    onJoined(joinData.token, id);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const name = nickname.trim();
    if (!name) return setError("Enter an alias to continue.");

    localStorage.setItem("gridlock_commander", name);
    setIsLoading(true);
    try {
      const roomRes = await fetch(`${backendUrl}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: boardSize,
          height: boardSize,
          timeLimit,
        }),
      });
      if (!roomRes.ok) throw new Error("Could not reach the server.");
      const { roomId } = await roomRes.json();
      await executeJoin(name, roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Server error creating room.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const name = nickname.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name) return setError("Enter an alias to continue.");
    if (code.length < 6) return setError("Room codes are at least 6 letters.");

    localStorage.setItem("gridlock_commander", name);
    setIsLoading(true);
    try {
      await executeJoin(name, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join that room.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-dvh w-full bg-zinc-950 text-zinc-100 bg-grid-paper">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/40 to-zinc-950" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-5 pb-8 pt-10 sm:max-w-lg sm:px-8 sm:pt-16">
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-3">
            <GridMark className="h-9 w-9 text-violet-400" />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
              v1 · real-time
            </span>
          </div>
          <h1 className="text-4xl font-black leading-none tracking-tight text-white sm:text-5xl">
            GridLock
          </h1>
          <p className="mt-3 max-w-sm text-sm text-zinc-400 sm:text-base">
            Tactical territory control. Claim tiles, defend your turf, outpace the clock.
          </p>
        </header>

        <section className="space-y-5">
          <label className="block">
            <span className="mb-2 block font-mono text-xs uppercase tracking-widest text-zinc-500">
              Alias
            </span>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="off"
              autoComplete="off"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Your call sign"
              className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-base text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              maxLength={15}
            />
          </label>

          <div className="flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`tap-instant flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                mode === "create"
                  ? "bg-violet-500 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Create room
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`tap-instant flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                mode === "join"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Join room
            </button>
          </div>

          {mode === "create" ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="tap-instant flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left text-sm text-zinc-300 hover:border-zinc-700"
              >
                <span className="font-medium">Match settings</span>
                <span className="font-mono text-xs text-zinc-500">
                  {boardSize}×{boardSize} · {formatDuration(timeLimit)}
                  <span className="ml-2 text-zinc-600">{showAdvanced ? "close" : "edit"}</span>
                </span>
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <SelectField
                    label="Board"
                    value={boardSize}
                    onChange={setBoardSize}
                    options={BOARD_SIZES.map((n) => ({
                      value: n,
                      label: `${n}×${n}`,
                    }))}
                  />
                  <SelectField
                    label="Time"
                    value={timeLimit}
                    onChange={setTimeLimit}
                    options={TIME_OPTIONS.map((sec) => ({
                      value: sec,
                      label: formatDuration(sec),
                    }))}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="tap-instant h-12 w-full rounded-xl bg-violet-500 text-base font-semibold text-white transition-colors hover:bg-violet-400 active:bg-violet-600 disabled:cursor-not-allowed disabled:bg-violet-500/40"
              >
                {isLoading ? "Opening the room…" : "Create & enter"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <label className="block">
                <span className="mb-2 block font-mono text-xs uppercase tracking-widest text-zinc-500">
                  Room code
                </span>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ABC-DEF"
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 font-mono text-lg uppercase tracking-[0.2em] text-white placeholder-zinc-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  maxLength={7}
                />
              </label>
              <button
                type="submit"
                disabled={isLoading || roomCode.length < 6}
                className="tap-instant h-12 w-full rounded-xl bg-emerald-500 text-base font-semibold text-white transition-colors hover:bg-emerald-400 active:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-500/30"
              >
                {isLoading ? "Connecting…" : "Join room"}
              </button>
            </form>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
              {error}
            </p>
          )}
        </section>

        <footer className="mt-10 border-t border-zinc-900 pt-5 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600">
          Go · React · WebSockets
        </footer>
      </div>
    </main>
  );
}

const BOARD_SIZES = [8, 10, 12, 14, 16, 20, 24, 30];
const TIME_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 300];

function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function SelectField<T extends number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="relative flex items-center rounded-lg border border-zinc-800 bg-zinc-950 focus-within:border-violet-500">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value) as T)}
          className="tap-instant h-10 w-full cursor-pointer appearance-none bg-transparent pl-3 pr-8 text-base font-semibold text-white focus:outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className="pointer-events-none absolute right-2.5 h-4 w-4 text-zinc-500"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </label>
  );
}
