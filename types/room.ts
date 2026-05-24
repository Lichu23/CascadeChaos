export type RoomPhase = "lobby" | "drawing" | "reveal" | "voting" | "leaderboard" | "ended";

export type RoomSettings = {
  roundTime: number;
  totalRounds: number;
};

export type RoomPlayer = {
  guestId: string;
  username: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  joinedAt: number;
};

export type PublicRoom = {
  code: string;
  phase: RoomPhase;
  hostId: string | null;
  settings: RoomSettings;
  players: RoomPlayer[];
};

export type RoomError = {
  code: string;
  message: string;
};

export type StartBlockedPayload = {
  activePlayers: number;
  minPlayers: number;
  message: string;
};

