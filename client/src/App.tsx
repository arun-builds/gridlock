import { useState } from "react";
import GameRoom from "./components/GameRoom";
import Lobby from "./components/Lobby";

export default function App() {
  const [session, setSession] = useState<{ token: string; roomId: string } | null>(null);

  if (!session) {
    return (
      <Lobby
        onJoined={(token, roomId) => setSession({ token, roomId })}
      />
    );
  }

  return (
    <GameRoom
      token={session.token}
      roomId={session.roomId}
      onLeave={() => setSession(null)}
    />
  );
}
