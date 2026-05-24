import type { PublicRoom, RoomError, RoomSettings, StartBlockedPayload } from "./room";

export type ServerToClientEvents = {
  "room:joined": (room: PublicRoom) => void;
  "room:state": (room: PublicRoom) => void;
  "room:error": (error: RoomError) => void;
  "game:start-blocked": (payload: StartBlockedPayload) => void;
  "game:started": (room: PublicRoom) => void;
};

export type ClientToServerEvents = {
  "room:create": (payload: { guestId: string; username: string }) => void;
  "room:join": (payload: { roomCode: string; guestId: string; username: string }) => void;
  "room:update-settings": (payload: {
    roomCode: string;
    guestId: string;
    settings: RoomSettings;
  }) => void;
  "game:start": (payload: { roomCode: string; guestId: string }) => void;
  "room:leave": () => void;
};

