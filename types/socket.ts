import type {
  DrawingSubmittedPayload,
  PublicRoom,
  RoundAdvancedPayload,
  RoomClosedPayload,
  RoomError,
  RoomSettings,
  StartBlockedPayload,
  VoteCastPayload,
  VotingStartedPayload,
} from "./room";

export type ServerToClientEvents = {
  "room:joined": (room: PublicRoom) => void;
  "room:state": (room: PublicRoom) => void;
  "room:error": (error: RoomError) => void;
  "room:closed": (payload: RoomClosedPayload) => void;
  "game:start-blocked": (payload: StartBlockedPayload) => void;
  "game:started": (room: PublicRoom) => void;
  "drawing:submitted": (payload: DrawingSubmittedPayload) => void;
  "voting:started": (payload: VotingStartedPayload) => void;
  "vote:cast": (payload: VoteCastPayload) => void;
  "round:advanced": (payload: RoundAdvancedPayload) => void;
};

export type ClientToServerEvents = {
  "room:create": (payload: { guestId: string; username: string }) => void;
  "room:join": (payload: { roomCode: string; guestId: string; username: string }) => void;
  "room:update-settings": (payload: {
    roomCode: string;
    guestId: string;
    settings: RoomSettings;
  }) => void;
  "room:set-ready": (payload: { roomCode: string; guestId: string; ready: boolean }) => void;
  "game:return-lobby": (payload: { roomCode: string; guestId: string }) => void;
  "game:start": (payload: { roomCode: string; guestId: string }) => void;
  "drawing:submit": (payload: {
    roomCode: string;
    guestId: string;
    dataUrl: string;
  }) => void;
  "drawing:draft": (payload: {
    roomCode: string;
    guestId: string;
    dataUrl: string;
  }) => void;
  "voting:start": (payload: { roomCode: string; guestId: string }) => void;
  "vote:cast": (payload: {
    roomCode: string;
    guestId: string;
    targetGuestId: string;
  }) => void;
  "round:next": (payload: { roomCode: string; guestId: string }) => void;
  "room:leave": () => void;
};

