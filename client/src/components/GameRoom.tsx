import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameEngine } from "../lib/hooks/useGameEngine";
import { GridMark } from "./GridMark";

const PLAYER_COLORS: { bg: string; ring: string; text: string }[] = [
  { bg: "bg-blue-500", ring: "ring-blue-400", text: "text-blue-300" },
  { bg: "bg-red-500", ring: "ring-red-400", text: "text-red-300" },
  { bg: "bg-emerald-500", ring: "ring-emerald-400", text: "text-emerald-300" },
  { bg: "bg-violet-500", ring: "ring-violet-400", text: "text-violet-300" },
  { bg: "bg-pink-500", ring: "ring-pink-400", text: "text-pink-300" },
  { bg: "bg-amber-500", ring: "ring-amber-400", text: "text-amber-300" },
  { bg: "bg-cyan-500", ring: "ring-cyan-400", text: "text-cyan-300" },
  { bg: "bg-lime-500", ring: "ring-lime-400", text: "text-lime-300" },
  { bg: "bg-orange-500", ring: "ring-orange-400", text: "text-orange-300" },
  { bg: "bg-fuchsia-500", ring: "ring-fuchsia-400", text: "text-fuchsia-300" },
  { bg: "bg-teal-500", ring: "ring-teal-400", text: "text-teal-300" },
  { bg: "bg-indigo-500", ring: "ring-indigo-400", text: "text-indigo-300" },
];

const hashPlayerId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

interface GameRoomProps {
  token: string;
  roomId: string;
  onLeave: () => void;
}

export default function GameRoom({ token, roomId, onLeave }: GameRoomProps) {
  const { gameState, interactWithTile, resetGame, localUserId } = useGameEngine(
    roomId,
    token
  );

  const getColorForId = useCallback((id: string) => {
    return PLAYER_COLORS[hashPlayerId(id) % PLAYER_COLORS.length];
  }, []);

  const liveScores = useMemo(() => {
    const scores: Record<string, number> = {};
    Object.values(gameState.grid).forEach((tile) => {
      if (tile.ownerId) scores[tile.ownerId] = (scores[tile.ownerId] || 0) + 1;
    });
    return scores;
  }, [gameState.grid]);

  const rankedPlayers = useMemo(() => {
    return Object.entries(liveScores)
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);
  }, [liveScores]);

  // Instant visual feedback for the tile you just tapped, independent of WS latency.
  const [flashTiles, setFlashTiles] = useState<Record<string, number>>({});
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (flashTimerRef.current) return;
    flashTimerRef.current = window.setInterval(() => {
      setFlashTiles((prev) => {
        const now = performance.now();
        let changed = false;
        const next: Record<string, number> = {};
        for (const key in prev) {
          if (now - prev[key] < 160) {
            next[key] = prev[key];
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 120);
    return () => {
      if (flashTimerRef.current) window.clearInterval(flashTimerRef.current);
      flashTimerRef.current = null;
    };
  }, []);

  const handleTileTap = useCallback(
    (x: number, y: number) => {
      const key = `${x},${y}`;
      setFlashTiles((prev) => ({ ...prev, [key]: performance.now() }));
      interactWithTile(x, y);
    },
    [interactWithTile]
  );

  if (gameState.status === "connecting") {
    return (
      <StatusShell>
        <div className="flex flex-col items-center gap-3">
          <GridMark className="h-10 w-10 animate-pulse text-violet-400" />
          <p className="font-mono text-sm uppercase tracking-widest text-zinc-500">
            Establishing link…
          </p>
        </div>
      </StatusShell>
    );
  }

  if (gameState.status === "disconnected") {
    return (
      <StatusShell>
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <GridMark className="h-10 w-10 text-zinc-600" />
          <p className="text-lg font-semibold text-zinc-100">Connection lost</p>
          <p className="text-sm text-zinc-400">
            We couldn’t keep the link to the server open. You can head back and
            try again.
          </p>
          <button
            onClick={onLeave}
            className="tap-instant h-11 rounded-lg bg-violet-500 px-6 text-sm font-semibold text-white hover:bg-violet-400 active:bg-violet-600"
          >
            Back to lobby
          </button>
        </div>
      </StatusShell>
    );
  }

  const myColor = localUserId ? getColorForId(localUserId) : PLAYER_COLORS[0];
  const myScore = localUserId ? liveScores[localUserId] || 0 : 0;
  const timePct = gameState.maxTime
    ? Math.max(0, Math.min(1, gameState.timeRemaining / gameState.maxTime))
    : 1;

  return (
    <main className="no-tap-highlight flex min-h-dvh flex-col bg-zinc-950 text-zinc-100">
      <Header
        roomId={roomId}
        timeRemaining={gameState.timeRemaining}
        status={gameState.status}
        timePct={timePct}
        onLeave={onLeave}
      />

      <div className="flex flex-1 min-h-0 items-center justify-center px-3 py-3 sm:px-6 sm:py-4">
        <Board
          gameState={gameState}
          localUserId={localUserId}
          getColorForId={getColorForId}
          flashTiles={flashTiles}
          onTap={handleTileTap}
        />
      </div>

      <Scoreboard
        rankedPlayers={rankedPlayers}
        myUserId={localUserId}
        myColor={myColor}
        myScore={myScore}
        getColorForId={getColorForId}
      />

      {gameState.status === "finished" && (
        <GameOverOverlay
          gameState={gameState}
          localUserId={localUserId}
          onRematch={resetGame}
          onLeave={onLeave}
        />
      )}
    </main>
  );
}

function Header({
  roomId,
  timeRemaining,
  status,
  timePct,
  onLeave,
}: {
  roomId: string;
  timeRemaining: number;
  status: string;
  timePct: number;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        await navigator.share({ title: "GridLock room", text: roomId });
      } else {
        await navigator.clipboard.writeText(roomId);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // no-op
    }
  };

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          onClick={onLeave}
          aria-label="Leave room"
          className="tap-instant flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          onClick={handleCopy}
          className="tap-instant flex min-w-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-left hover:border-zinc-700"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            Room
          </span>
          <span className="truncate font-mono text-sm font-bold tracking-[0.2em] text-white">
            {roomId}
          </span>
          <span className="text-xs text-violet-300">{copied ? "copied" : "copy"}</span>
        </button>

        <div className="ml-auto flex items-center gap-3">
          <StatusPill status={status} />
          <div className="text-right">
            <div className="font-mono text-xs uppercase tracking-widest text-zinc-500">
              Time
            </div>
            <div className="font-mono text-xl font-black leading-none text-white tabular-nums">
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>
      </div>
      <div className="h-0.5 w-full bg-zinc-900">
        <div
          className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-500 transition-[width] duration-300"
          style={{ width: `${timePct * 100}%` }}
        />
      </div>
    </header>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    waiting: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    playing: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    finished: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  };
  const cls = styles[status] ?? "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30";
  return (
    <span
      className={`hidden rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ring-1 sm:inline-block ${cls}`}
    >
      {status}
    </span>
  );
}

function Board({
  gameState,
  localUserId,
  getColorForId,
  flashTiles,
  onTap,
}: {
  gameState: ReturnType<typeof useGameEngine>["gameState"];
  localUserId: string;
  getColorForId: (id: string) => (typeof PLAYER_COLORS)[number];
  flashTiles: Record<string, number>;
  onTap: (x: number, y: number) => void;
}) {
  const w = gameState.gridWidth;
  const h = gameState.gridHeight;

  const tileClass = (x: number, y: number) => {
    const key = `${x},${y}`;
    const tile = gameState.grid[key];
    const flashed = !!flashTiles[key];

    let base = "bg-zinc-800/80";
    let extras = "";

    if (tile?.ownerId) {
      base = getColorForId(tile.ownerId).bg;
    }

    if (tile?.contested) {
      extras = "ring-2 ring-yellow-300/90 animate-pulse";
    }

    const minePressed = flashed ? "animate-tile-pop brightness-125" : "";
    const youOwn = tile?.ownerId && tile.ownerId === localUserId ? "ring-1 ring-white/30" : "";

    return `tap-instant rounded-[3px] transition-[background-color,box-shadow] duration-100 active:brightness-110 ${base} ${extras} ${youOwn} ${minePressed}`;
  };

  return (
    <div
      className="grid rounded-xl border border-zinc-800 bg-zinc-900/60 p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]"
      style={{
        gridTemplateColumns: `repeat(${w}, minmax(0, 1fr))`,
        gap: "2px",
        aspectRatio: `${w} / ${h}`,
        width: `min(100%, calc((100dvh - 12.5rem) * ${w / h}))`,
      }}
    >
      {Array.from({ length: h }).map((_, y) =>
        Array.from({ length: w }).map((_, x) => (
          <button
            key={`${x}-${y}`}
            className={tileClass(x, y)}
            onPointerDown={(e) => {
              e.preventDefault();
              onTap(x, y);
            }}
          />
        ))
      )}
    </div>
  );
}

function Scoreboard({
  rankedPlayers,
  myUserId,
  myColor,
  myScore,
  getColorForId,
}: {
  rankedPlayers: { id: string; score: number }[];
  myUserId: string;
  myColor: (typeof PLAYER_COLORS)[number];
  myScore: number;
  getColorForId: (id: string) => (typeof PLAYER_COLORS)[number];
}) {
  return (
    <footer className="sticky bottom-0 z-10 border-t border-zinc-900 bg-zinc-950/95 backdrop-blur-sm">
      <div
        className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
          <div className={`h-2.5 w-2.5 rounded-full ${myColor.bg}`} />
          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              You
            </span>
            <span className="truncate font-mono text-sm font-bold text-white">
              {myUserId ? myUserId.split("-")[0] : "—"}
            </span>
          </div>
          <div className="ml-2 border-l border-zinc-800 pl-3 text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Tiles
            </div>
            <div className="font-mono text-base font-black tabular-nums text-white">
              {myScore}
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {rankedPlayers.length === 0 && (
            <div className="w-full rounded-lg border border-dashed border-zinc-800 px-3 py-2 text-center font-mono text-[11px] uppercase tracking-widest text-zinc-600">
              Claim a tile to enter the board
            </div>
          )}
          {rankedPlayers.map((p, idx) => {
            const c = getColorForId(p.id);
            const isMe = p.id === myUserId;
            return (
              <div
                key={p.id}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                  isMe
                    ? "border-zinc-700 bg-zinc-800"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                  #{idx + 1}
                </span>
                <div className={`h-2 w-2 rounded-full ${c.bg}`} />
                <span className="font-mono text-xs font-semibold text-zinc-200">
                  {p.id.split("-")[0]}
                </span>
                <span className="font-mono text-xs font-bold tabular-nums text-white">
                  {p.score}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </footer>
  );
}

function GameOverOverlay({
  gameState,
  localUserId,
  onRematch,
  onLeave,
}: {
  gameState: ReturnType<typeof useGameEngine>["gameState"];
  localUserId: string;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const isTie = gameState.winnerId === "TIE";
  const iWon = gameState.winnerId === localUserId;
  const myScore = gameState.scores?.[localUserId] ?? 0;
  const winnerScore = gameState.winnerId
    ? gameState.scores?.[gameState.winnerId] ?? 0
    : 0;

  const title = isTie ? "Stalemate" : iWon ? "Victory" : "Defeat";
  const subtitle = isTie
    ? "The grid stayed divided."
    : iWon
      ? "You locked the grid down."
      : "You were overrun.";
  const accent = isTie
    ? "text-zinc-200"
    : iWon
      ? "text-emerald-300"
      : "text-red-300";

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
            Match complete
          </div>
          <h2 className={`text-4xl font-black tracking-tight sm:text-5xl ${accent}`}>
            {title}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              You
            </div>
            <div className="mt-1 font-mono text-3xl font-black tabular-nums text-white">
              {myScore}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {iWon ? "Runner-up" : "Winner"}
            </div>
            <div className="mt-1 font-mono text-3xl font-black tabular-nums text-white">
              {isTie ? "—" : winnerScore}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onLeave}
            className="tap-instant h-12 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-semibold text-zinc-200 hover:border-zinc-700"
          >
            Leave
          </button>
          <button
            onClick={onRematch}
            className="tap-instant h-12 flex-1 rounded-xl bg-violet-500 text-sm font-semibold text-white hover:bg-violet-400 active:bg-violet-600"
          >
            Rematch
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      {children}
    </main>
  );
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
