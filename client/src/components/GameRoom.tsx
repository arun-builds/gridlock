import { useGameEngine } from "../lib/hooks/useGameEngine";


const PLAYER_COLORS = [
  "bg-blue-500", "bg-red-500", "bg-emerald-500", 
  "bg-purple-500", "bg-pink-500", "bg-amber-500", "bg-cyan-500"
];


const getColorForId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
};

export default function GameRoom({ token }: { token: string }) {

  const { gameState, interactWithTile, localUserId } = useGameEngine("test-lobby-1", token);

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
              {localUserId.split('-')[0]} 
            </span>
          </div>
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