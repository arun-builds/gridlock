import { useMemo } from "react";
import { useGameEngine } from "../lib/hooks/useGameEngine";


const PLAYER_COLORS = [
  "bg-blue-500", "bg-red-500", "bg-emerald-500", "bg-purple-500",
  "bg-pink-500", "bg-amber-500", "bg-cyan-500", "bg-lime-500",
  "bg-orange-500", "bg-fuchsia-500", "bg-teal-500", "bg-indigo-500",
];

const hashPlayerId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

export default function GameRoom({ token, roomId }: { token: string; roomId: string }) {

  const { gameState, interactWithTile, resetGame, localUserId } = useGameEngine(roomId, token);

  const colorByOwnerId = useMemo(() => {
    const ownerIds = new Set<string>();
    if (localUserId) ownerIds.add(localUserId);

    Object.values(gameState.grid).forEach((tile) => {
      if (tile.ownerId) ownerIds.add(tile.ownerId);
    });

    const colorMap: Record<string, string> = {};
    // Keep colors fully stable per player ID. Avoiding collision resolution
    // prevents mid-match remapping when active owners change.
    Array.from(ownerIds).forEach((ownerId) => {
      const colorIndex = hashPlayerId(ownerId) % PLAYER_COLORS.length;
      colorMap[ownerId] = PLAYER_COLORS[colorIndex];
    });

    return colorMap;
  }, [gameState.grid, localUserId]);

  const getColorForId = (id: string) => colorByOwnerId[id] ?? PLAYER_COLORS[hashPlayerId(id) % PLAYER_COLORS.length];

  const getTileClasses = (x: number, y: number) => {
    const tileKey = `${x},${y}`;
    const tile = gameState.grid[tileKey];

    if (!tile) return "bg-zinc-800 hover:bg-zinc-700";

    // Keep owner color visible even while under attack.
    const baseColor = tile.ownerId ? getColorForId(tile.ownerId) : "bg-zinc-600";

    if (!tile.contested) return baseColor;

    // Use yellow pulse only for neutral contested tiles.
    if (!tile.ownerId) return `${baseColor} animate-pulse ring-1 ring-yellow-300`;

    // Owned + contested: preserve ownership and add attack indicator.
    return `${baseColor} ring-2 ring-yellow-300 animate-pulse`;
  };

  if (gameState.status === "connecting") {
    return <div className="text-zinc-400 animate-pulse mt-20">Establishing secure link to Go Server...</div>;
  }

  // NEW: The Game Over Screen
  if (gameState.status === "finished") {
    const isTie = gameState.winnerId === "TIE";
    const iWon = gameState.winnerId === localUserId;

    // Find our own score, defaulting to 0 if we didn't capture anything
    const myScore = gameState.scores?.[localUserId] || 0;

    return (
      <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto mt-20 bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-2xl">
        <h2 className="text-5xl font-black mb-2 uppercase tracking-tighter">
          {isTie ? "Stalemate" : iWon ? "Victory" : "Defeat"}
        </h2>

        <p className="text-zinc-400 mb-8 text-lg">
          {isTie ? "The grid remains divided." : iWon ? "You control the grid." : "You were overrun."}
        </p>

        <div className="flex items-center gap-6 mb-8 bg-zinc-950 p-6 rounded-xl border border-zinc-800 w-full justify-between">
          <div className="flex flex-col">
            <span className="text-sm text-zinc-500 uppercase">Your Territory</span>
            <span className="text-3xl font-mono text-white">{myScore} tiles</span>
          </div>

          {!isTie && !iWon && gameState.winnerId && (
            <div className="flex flex-col items-end">
              <span className="text-sm text-zinc-500 uppercase">Winner's Territory</span>
              <span className="text-3xl font-mono text-red-400">
                {gameState.scores?.[gameState.winnerId] || 0} tiles
              </span>
            </div>
          )}
        </div>

        <button
          onClick={resetGame}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg transition-colors"
        >
         Initialize Rematch
        </button>
      </div>
    );
  }

  // Figure out what color YOU are
  const myColor = localUserId ? getColorForId(localUserId) : "bg-zinc-800";

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
      {/* HUD */}
      <div className="w-full flex justify-between items-center mb-6 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
        <div className="flex flex-col items-start">
          <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Your Identity</span>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${myColor}`} />
            <span className="text-sm font-mono text-zinc-300">
              {localUserId ? localUserId.split("-")[0] : "unknown"}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Room Code</span>
          <span className="text-blue-400 font-mono font-bold tracking-widest bg-blue-900/30 px-2 py-1 rounded">
            {roomId}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Status</span>
          <span className="text-green-400 font-bold uppercase">{gameState.status}</span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Time</span>
          <span className="text-3xl font-mono font-black text-white">
            {gameState.timeRemaining}s
          </span>
        </div>
      </div>

      {/* Grid */}
      <div 
        className="w-full aspect-square bg-zinc-900 border-2 border-zinc-800 rounded-lg p-2 gap-1 grid"
        style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))' }}
      >
        {Array.from({ length: 20 }).map((_, y) => (
          Array.from({ length: 20 }).map((_, x) => (
            <button
              key={`${x}-${y}`}
              className={`w-full h-full rounded-sm transition-colors duration-75 ${getTileClasses(x, y)}`}
              onPointerDown={() => interactWithTile(x, y)}
            />
          ))
        ))}
      </div>
    </div>
  );
}