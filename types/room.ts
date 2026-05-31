export type RoomPhase =
  | "lobby"
  | "countdown"
  | "drawing"
  | "reveal"
  | "voting"
  | "leaderboard"
  | "ended"
  | "interrupted";

export type RoomSettings = {
  roundTime: number;
  totalRounds: number;
};

export type RoomPlayer = {
  guestId: string;
  username: string;
  score: number;
  connected: boolean;
  ready: boolean;
  returnedToLobby: boolean;
  isHost: boolean;
  joinedAt: number;
};

export type PublicRoundParticipant = {
  guestId: string;
  username: string;
};

export type PublicDrawingSubmission = {
  guestId: string;
  username: string;
  dataUrl: string;
  submittedAt: number;
};

export type PublicVoteState = {
  startedAt: number;
  endsAt: number;
  votedGuestIds: string[];
  voteCount: number;
  expectedVotes: number;
  isVotingOpen: boolean;
};

export type PublicRoundResult = {
  guestId: string;
  username: string;
  votes: number;
};

export type PublicRound = {
  number: number;
  totalRounds: number;
  challengeId: string;
  startedAt: number;
  endsAt: number;
  revealEndsAt: number | null;
  leaderboardEndsAt: number | null;
  participants: PublicRoundParticipant[];
  submissions: PublicDrawingSubmission[];
  submittedGuestIds: string[];
  submissionCount: number;
  expectedSubmissions: number;
  isSubmissionOpen: boolean;
  voting: PublicVoteState | null;
  results: PublicRoundResult[];
};

export type PublicRoom = {
  code: string;
  phase: RoomPhase;
  hostId: string | null;
  settings: RoomSettings;
  countdownEndsAt: number | null;
  players: RoomPlayer[];
  round: PublicRound | null;
  interruptedReason: string | null;
};

export type RoomError = {
  code: string;
  message: string;
};

export type RoomClosedPayload = {
  code: string;
  message: string;
};

export type StartBlockedPayload = {
  activePlayers: number;
  minPlayers: number;
  message: string;
};

export type DrawingSubmittedPayload = {
  guestId: string;
  submittedGuestIds: string[];
  submissionCount: number;
  expectedSubmissions: number;
  isSubmissionOpen: boolean;
};

export type VotingStartedPayload = {
  room: PublicRoom;
};

export type VoteCastPayload = {
  guestId: string;
  votedGuestIds: string[];
  voteCount: number;
  expectedVotes: number;
  isVotingOpen: boolean;
};

export type RoundAdvancedPayload = {
  room: PublicRoom;
};

