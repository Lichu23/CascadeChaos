import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const dev =
  process.env.NODE_ENV === "development" ||
  (!process.env.NODE_ENV && process.env.npm_lifecycle_event !== "start");
const app = next({ dev, port });
const handle = app.getRequestHandler();

const MIN_PLAYERS_TO_START = 3;
const ROOM_CODE_LENGTH = 5;
const DISCONNECT_GRACE_MS = 30_000;
const EMPTY_ROOM_TTL_MS = 5 * 60_000;
const REVEAL_TIME_MS = 10_000;
const LEADERBOARD_TIME_MS = 5_000;
const VOTING_TIME_MS = 30_000;
const CHALLENGE_IDS = [
  "crypto",
  "dashboard",
  "fitness-card",
  "media-view",
  "music-card",
  "productivity-card",
  "profile-card",
  "sales-view",
  "shop-card",
  "travel-card",
  "weather-card",
];

const rooms = new Map();

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function createUniqueRoomCode() {
  let code = makeRoomCode();

  while (rooms.has(code)) {
    code = makeRoomCode();
  }

  return code;
}

function sanitizeUsername(username) {
  return String(username || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function publicRoom(room) {
  const round = room.round
    ? {
        number: room.round.number,
        totalRounds: room.settings.totalRounds,
        challengeId: room.round.challengeId,
        startedAt: room.round.startedAt,
        endsAt: room.round.endsAt,
        revealEndsAt: room.round.revealEndsAt ?? null,
        leaderboardEndsAt: room.round.leaderboardEndsAt ?? null,
        participants: room.round.participantIds.map((guestId) => ({
          guestId,
          username: room.players.get(guestId)?.username ?? "Player",
        })),
        submissions: Array.from(room.round.submissions.values()).map((submission) => ({
          guestId: submission.guestId,
          username: room.players.get(submission.guestId)?.username ?? "Player",
          dataUrl: submission.dataUrl,
          submittedAt: submission.submittedAt,
        })),
        submittedGuestIds: Array.from(room.round.submissions.keys()),
        submissionCount: room.round.submissions.size,
        expectedSubmissions: room.round.participantIds.length,
        isSubmissionOpen: isSubmissionOpen(room),
        voting: room.round.voting
          ? {
              startedAt: room.round.voting.startedAt,
              endsAt: room.round.voting.endsAt,
              votedGuestIds: Array.from(room.round.voting.votes.keys()),
              voteCount: room.round.voting.votes.size,
              expectedVotes: expectedVoters(room).length,
              isVotingOpen: isVotingOpen(room),
            }
          : null,
        results: roundResults(room),
      }
    : null;

  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    settings: room.settings,
    round,
    players: Array.from(room.players.values()).map((player) => ({
      guestId: player.guestId,
      username: player.username,
      score: player.score,
      connected: player.connected,
      ready: player.ready,
      returnedToLobby: player.returnedToLobby,
      isHost: player.guestId === room.hostId,
      joinedAt: player.joinedAt,
    })),
  };
}

function activePlayers(room) {
  return Array.from(room.players.values()).filter((player) => player.connected);
}

function resetLobbyReadiness(room) {
  for (const player of room.players.values()) {
    player.ready = false;
    player.returnedToLobby = false;
  }
}

function canAutoStart(room) {
  const players = activePlayers(room);

  return players.length >= MIN_PLAYERS_TO_START && players.every((player) => player.ready);
}

function maybeAutoStartGame(io, room) {
  if (room.phase !== "lobby" || !canAutoStart(room)) {
    return false;
  }

  startDrawingRound(io, room);
  io.to(room.code).emit("game:started", publicRoom(room));
  emitRoom(io, room);
  return true;
}

function emitRoom(io, room) {
  io.to(room.code).emit("room:state", publicRoom(room));
}

function emitError(socket, code, message) {
  socket.emit("room:error", { code, message });
}

function isSubmissionOpen(room) {
  return room.phase === "drawing" && room.round && !room.round.closed && Date.now() <= room.round.endsAt;
}

function isVotingOpen(room) {
  return room.phase === "voting" && room.round?.voting && !room.round.voting.closed && Date.now() <= room.round.voting.endsAt;
}

function expectedVoters(room) {
  if (!room.round) {
    return [];
  }

  return room.round.participantIds.filter((guestId) => room.players.get(guestId)?.connected);
}

function roundResults(room) {
  if (!room.round?.voting) {
    return [];
  }

  const voteCounts = new Map();

  for (const submission of room.round.submissions.values()) {
    voteCounts.set(submission.guestId, 0);
  }

  for (const targetGuestId of room.round.voting.votes.values()) {
    voteCounts.set(targetGuestId, (voteCounts.get(targetGuestId) ?? 0) + 1);
  }

  return Array.from(voteCounts.entries())
    .map(([guestId, votes]) => ({
      guestId,
      username: room.players.get(guestId)?.username ?? "Player",
      votes,
    }))
    .sort((left, right) => right.votes - left.votes || left.username.localeCompare(right.username));
}

function reassignHost(room) {
  if (room.hostId && room.players.get(room.hostId)?.connected) {
    return;
  }

  room.hostId = activePlayers(room)[0]?.guestId ?? null;
}

function clearRoundTimers(room) {
  if (room.round?.timer) {
    clearTimeout(room.round.timer);
    room.round.timer = null;
  }

  if (room.round?.revealTimer) {
    clearTimeout(room.round.revealTimer);
    room.round.revealTimer = null;
  }

  if (room.round?.voting?.timer) {
    clearTimeout(room.round.voting.timer);
    room.round.voting.timer = null;
  }

  if (room.round?.leaderboardTimer) {
    clearTimeout(room.round.leaderboardTimer);
    room.round.leaderboardTimer = null;
  }
}

function scheduleRoomCleanup(io, room) {
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
  }

  room.cleanupTimer = setTimeout(() => {
    const latestRoom = rooms.get(room.code);

    if (!latestRoom || activePlayers(latestRoom).length > 0) {
      return;
    }

    rooms.delete(room.code);
    io.socketsLeave(room.code);
  }, EMPTY_ROOM_TTL_MS);
}

function pickChallengeId(room, roundNumber) {
  const usedIds = room.challengeOrder ?? [];

  if (usedIds[roundNumber - 1]) {
    return usedIds[roundNumber - 1];
  }

  const remainingIds = CHALLENGE_IDS.filter((challengeId) => !usedIds.includes(challengeId));
  const pool = remainingIds.length > 0 ? remainingIds : CHALLENGE_IDS;
  const challengeId = pool[Math.floor(Math.random() * pool.length)];

  room.challengeOrder = [...usedIds, challengeId];
  return challengeId;
}

function closeDrawingRound(io, room) {
  if (!room.round || room.round.closed) {
    return;
  }

  for (const [guestId, draft] of room.round.drafts.entries()) {
    if (!room.round.submissions.has(guestId)) {
      room.round.submissions.set(guestId, {
        guestId,
        dataUrl: draft.dataUrl,
        submittedAt: Date.now(),
      });
    }
  }

  room.round.closed = true;
  room.phase = "reveal";
  room.round.revealEndsAt = Date.now() + REVEAL_TIME_MS;

  if (room.round.timer) {
    clearTimeout(room.round.timer);
    room.round.timer = null;
  }

  emitRoom(io, room);

  room.round.revealTimer = setTimeout(() => {
    const latestRoom = rooms.get(room.code);

    if (!latestRoom || latestRoom.phase !== "reveal" || !latestRoom.round) {
      return;
    }

    startVoting(io, latestRoom);
    io.to(latestRoom.code).emit("voting:started", { room: publicRoom(latestRoom) });
    emitRoom(io, latestRoom);
  }, REVEAL_TIME_MS);
}

function closeVoting(io, room) {
  if (!room.round?.voting || room.round.voting.closed) {
    return;
  }

  room.round.voting.closed = true;

  if (room.round.voting.timer) {
    clearTimeout(room.round.voting.timer);
    room.round.voting.timer = null;
  }

  for (const targetGuestId of room.round.voting.votes.values()) {
    const player = room.players.get(targetGuestId);

    if (player) {
      player.score += 1;
    }
  }

  room.phase = room.round.number >= room.settings.totalRounds ? "ended" : "leaderboard";

  if (room.phase === "leaderboard") {
    room.round.leaderboardEndsAt = Date.now() + LEADERBOARD_TIME_MS;
    room.round.leaderboardTimer = setTimeout(() => {
      const latestRoom = rooms.get(room.code);

      if (!latestRoom || latestRoom.phase !== "leaderboard" || !latestRoom.round) {
        return;
      }

      startDrawingRound(io, latestRoom);
      io.to(latestRoom.code).emit("round:advanced", { room: publicRoom(latestRoom) });
      emitRoom(io, latestRoom);
    }, LEADERBOARD_TIME_MS);
  }

  emitRoom(io, room);
}

function emitSubmissionProgress(io, room, guestId) {
  if (!room.round) {
    return;
  }

  io.to(room.code).emit("drawing:submitted", {
    guestId,
    submittedGuestIds: Array.from(room.round.submissions.keys()),
    submissionCount: room.round.submissions.size,
    expectedSubmissions: room.round.participantIds.length,
    isSubmissionOpen: isSubmissionOpen(room),
  });
}

function startDrawingRound(io, room) {
  const roundNumber = (room.round?.number ?? 0) + 1;
  const now = Date.now();
  const participantIds = activePlayers(room).map((player) => player.guestId);

  resetLobbyReadiness(room);

  if (room.round?.timer) {
    clearTimeout(room.round.timer);
  }

  room.phase = "drawing";
  room.round = {
    number: roundNumber,
    challengeId: pickChallengeId(room, roundNumber),
    startedAt: now,
    endsAt: now + room.settings.roundTime * 1000,
    participantIds,
    submissions: new Map(),
    drafts: new Map(),
    closed: false,
    revealEndsAt: null,
    leaderboardEndsAt: null,
    voting: null,
    timer: null,
  };

  room.round.timer = setTimeout(() => {
    closeDrawingRound(io, room);
  }, room.settings.roundTime * 1000);
}

function advanceRound(io, room) {
  if (!room.round) {
    return;
  }

  if (room.phase === "leaderboard") {
    startDrawingRound(io, room);
    io.to(room.code).emit("round:advanced", { room: publicRoom(room) });
    emitRoom(io, room);
    return;
  }

  if (room.phase === "ended") {
    io.to(room.code).emit("round:advanced", { room: publicRoom(room) });
    emitRoom(io, room);
  }
}

function returnToLobby(io, room) {
  clearRoundTimers(room);

  room.phase = "lobby";
  room.round = null;
  room.challengeOrder = [];

  for (const player of room.players.values()) {
    player.score = 0;
    player.ready = false;
    player.returnedToLobby = false;
  }

  emitRoom(io, room);
}

function maybeReturnAllToLobby(io, room) {
  const players = activePlayers(room);

  if (players.length === 0 || !players.every((player) => player.returnedToLobby)) {
    emitRoom(io, room);
    return;
  }

  returnToLobby(io, room);
}

function startVoting(io, room) {
  if (room.round?.revealTimer) {
    clearTimeout(room.round.revealTimer);
    room.round.revealTimer = null;
  }

  if (room.round?.voting?.timer) {
    clearTimeout(room.round.voting.timer);
  }

  const now = Date.now();
  room.phase = "voting";
  room.round.voting = {
    startedAt: now,
    endsAt: now + VOTING_TIME_MS,
    votes: new Map(),
    closed: false,
    timer: null,
  };
  room.round.voting.timer = setTimeout(() => {
    closeVoting(io, room);
  }, VOTING_TIME_MS);
}

function emitVoteProgress(io, room, guestId) {
  if (!room.round?.voting) {
    return;
  }

  io.to(room.code).emit("vote:cast", {
    guestId,
    votedGuestIds: Array.from(room.round.voting.votes.keys()),
    voteCount: room.round.voting.votes.size,
    expectedVotes: expectedVoters(room).length,
    isVotingOpen: isVotingOpen(room),
  });
}

function joinSocketToRoom({ io, socket, room, guestId, username }) {
  const existingPlayer = room.players.get(guestId);
  const duplicateUsername = activePlayers(room).some(
    (player) =>
      player.guestId !== guestId &&
      player.username.toLowerCase() === username.toLowerCase(),
  );

  if (duplicateUsername) {
    emitError(socket, "USERNAME_TAKEN", "That name is already being used in this room.");
    return false;
  }

  if (existingPlayer) {
    existingPlayer.username = username;
    existingPlayer.socketId = socket.id;
    existingPlayer.connected = true;
    existingPlayer.ready = false;
    existingPlayer.returnedToLobby = false;
    existingPlayer.lastSeenAt = Date.now();
  } else {
    room.players.set(guestId, {
      guestId,
      username,
      socketId: socket.id,
      connected: true,
      ready: false,
      returnedToLobby: false,
      score: 0,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    });
  }

  if (!room.hostId) {
    room.hostId = guestId;
  }

  socket.data.roomCode = room.code;
  socket.data.guestId = guestId;
  socket.join(room.code);

  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }

  socket.emit("room:joined", publicRoom(room));
  emitRoom(io, room);
  return true;
}

function leaveCurrentRoom(io, socket, { immediate = false } = {}) {
  const { roomCode, guestId } = socket.data;

  if (!roomCode || !guestId) {
    return;
  }

  const room = rooms.get(roomCode);

  if (!room) {
    return;
  }

  const player = room.players.get(guestId);

  if (player) {
    player.connected = false;
    player.ready = false;
    player.returnedToLobby = false;
    player.lastSeenAt = Date.now();
  }

  socket.leave(roomCode);

  if (immediate) {
    room.players.delete(guestId);
    reassignHost(room);
  }

  if (activePlayers(room).length === 0) {
    scheduleRoomCleanup(io, room);
  }

  if (immediate) {
    emitRoom(io, room);
    return;
  }

  setTimeout(() => {
    const latestRoom = rooms.get(roomCode);
    const latestPlayer = latestRoom?.players.get(guestId);

    if (!latestRoom || !latestPlayer || latestPlayer.connected) {
      return;
    }

    if (latestRoom.phase === "lobby") {
      latestRoom.players.delete(guestId);
      reassignHost(latestRoom);
      maybeAutoStartGame(io, latestRoom);
    } else {
      reassignHost(latestRoom);
    }

    emitRoom(io, latestRoom);
  }, DISCONNECT_GRACE_MS);

  emitRoom(io, room);
}

function normalizeSettings(settings) {
  return {
    roundTime: Math.min(180, Math.max(30, Number(settings?.roundTime) || 90)),
    totalRounds: Math.min(10, Math.max(1, Number(settings?.totalRounds) || 3)),
  };
}

await app.prepare();

const httpServer = createServer((req, res) => {
  if (req.url === "/api/socket-health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  handle(req, res);
});

const io = new Server(httpServer, {
  cors: {
    origin: dev ? ["http://localhost:3000", "http://127.0.0.1:3000"] : false,
  },
});

io.on("connection", (socket) => {
  socket.on("room:create", ({ guestId, username }) => {
    const cleanName = sanitizeUsername(username);

    if (!guestId || !cleanName) {
      emitError(socket, "INVALID_PLAYER", "Choose a name before creating a room.");
      return;
    }

    const code = createUniqueRoomCode();
    const room = {
      code,
      phase: "lobby",
      hostId: guestId,
      settings: {
        roundTime: 90,
        totalRounds: 3,
      },
      players: new Map(),
      round: null,
      challengeOrder: [],
      createdAt: Date.now(),
      cleanupTimer: null,
    };

    rooms.set(code, room);
    joinSocketToRoom({ io, socket, room, guestId, username: cleanName });
  });

  socket.on("room:join", ({ roomCode, guestId, username }) => {
    const cleanCode = String(roomCode || "").trim().toUpperCase();
    const cleanName = sanitizeUsername(username);
    const room = rooms.get(cleanCode);

    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "That room does not exist.");
      return;
    }

    if (room.phase !== "lobby" && !room.players.has(guestId)) {
      emitError(socket, "ROOM_ALREADY_STARTED", "That room already started.");
      return;
    }

    if (!guestId || !cleanName) {
      emitError(socket, "INVALID_PLAYER", "Choose a name before joining a room.");
      return;
    }

    joinSocketToRoom({ io, socket, room, guestId, username: cleanName });
  });

  socket.on("room:update-settings", ({ roomCode, guestId, settings }) => {
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());

    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "That room does not exist.");
      return;
    }

    if (room.hostId !== guestId) {
      emitError(socket, "HOST_ONLY", "Only the host can change room settings.");
      return;
    }

    if (room.phase !== "lobby") {
      emitError(socket, "ROOM_ALREADY_STARTED", "Settings are locked after the game starts.");
      return;
    }

    room.settings = normalizeSettings(settings);
    resetLobbyReadiness(room);
    emitRoom(io, room);
  });

  socket.on("room:set-ready", ({ roomCode, guestId, ready }) => {
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());

    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "That room does not exist.");
      return;
    }

    if (room.phase !== "lobby") {
      emitError(socket, "ROOM_ALREADY_STARTED", "Readiness is only available in the lobby.");
      return;
    }

    const player = room.players.get(guestId);

    if (!player || !player.connected) {
      emitError(socket, "PLAYER_NOT_IN_ROOM", "Join the room before readying up.");
      return;
    }

    player.ready = Boolean(ready);

    if (!maybeAutoStartGame(io, room)) {
      emitRoom(io, room);
    }
  });

  socket.on("game:return-lobby", ({ roomCode, guestId }) => {
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());

    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "That room does not exist.");
      return;
    }

    if (!room.players.has(guestId)) {
      emitError(socket, "PLAYER_NOT_IN_ROOM", "Join the room before returning to lobby.");
      return;
    }

    if (room.phase !== "ended") {
      emitError(socket, "GAME_NOT_ENDED", "The match is not finished yet.");
      return;
    }

    const player = room.players.get(guestId);

    if (!player || !player.connected) {
      emitError(socket, "PLAYER_NOT_IN_ROOM", "Join the room before returning to lobby.");
      return;
    }

    player.returnedToLobby = true;
    maybeReturnAllToLobby(io, room);
  });

  socket.on("game:start", ({ roomCode, guestId }) => {
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());

    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "That room does not exist.");
      return;
    }

    if (room.hostId !== guestId) {
      emitError(socket, "HOST_ONLY", "Only the host can start the game.");
      return;
    }

    const activeCount = activePlayers(room).length;

    if (activeCount < MIN_PLAYERS_TO_START) {
      socket.emit("game:start-blocked", {
        activePlayers: activeCount,
        minPlayers: MIN_PLAYERS_TO_START,
        message: `Need at least ${MIN_PLAYERS_TO_START} players to start.`,
      });
      return;
    }

    if (!canAutoStart(room)) {
      socket.emit("game:start-blocked", {
        activePlayers: activeCount,
        minPlayers: MIN_PLAYERS_TO_START,
        message: "All active players need to ready up before the game starts.",
      });
      return;
    }

    startDrawingRound(io, room);
    io.to(room.code).emit("game:started", publicRoom(room));
    emitRoom(io, room);
  });

  socket.on("drawing:submit", ({ roomCode, guestId, dataUrl }) => {
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());

    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "That room does not exist.");
      return;
    }

    if (room.phase !== "drawing" || !room.round) {
      emitError(socket, "DRAWING_NOT_ACTIVE", "There is no active drawing round.");
      return;
    }

    if (!room.round.participantIds.includes(guestId)) {
      emitError(socket, "PLAYER_NOT_IN_ROUND", "Only round players can submit drawings.");
      return;
    }

    if (!isSubmissionOpen(room)) {
      closeDrawingRound(io, room);
      emitError(socket, "DRAWING_CLOSED", "The drawing timer has ended.");
      return;
    }

    if (room.round.submissions.has(guestId)) {
      emitError(socket, "DRAWING_ALREADY_SUBMITTED", "Your drawing was already submitted.");
      return;
    }

    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) {
      emitError(socket, "INVALID_DRAWING", "Submit a valid canvas drawing.");
      return;
    }

    room.round.submissions.set(guestId, {
      guestId,
      dataUrl,
      submittedAt: Date.now(),
    });

    emitSubmissionProgress(io, room, guestId);
    emitRoom(io, room);

    if (room.round.submissions.size >= room.round.participantIds.length) {
      closeDrawingRound(io, room);
    }
  });

  socket.on("drawing:draft", ({ roomCode, guestId, dataUrl }) => {
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());

    if (!room || room.phase !== "drawing" || !room.round) {
      return;
    }

    if (!isSubmissionOpen(room) || !room.round.participantIds.includes(guestId)) {
      return;
    }

    if (room.round.submissions.has(guestId)) {
      return;
    }

    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) {
      return;
    }

    room.round.drafts.set(guestId, {
      guestId,
      dataUrl,
      updatedAt: Date.now(),
    });
  });

  socket.on("voting:start", ({ roomCode, guestId }) => {
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());

    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "That room does not exist.");
      return;
    }

    if (room.hostId !== guestId) {
      emitError(socket, "HOST_ONLY", "Only the host can start voting.");
      return;
    }

    if (room.phase !== "reveal" || !room.round) {
      emitError(socket, "REVEAL_NOT_ACTIVE", "Voting can only start from the reveal.");
      return;
    }

    startVoting(io, room);
    io.to(room.code).emit("voting:started", { room: publicRoom(room) });
    emitRoom(io, room);
  });

  socket.on("vote:cast", ({ roomCode, guestId, targetGuestId }) => {
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());

    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "That room does not exist.");
      return;
    }

    if (room.phase !== "voting" || !room.round?.voting) {
      emitError(socket, "VOTING_NOT_ACTIVE", "There is no active voting round.");
      return;
    }

    if (!isVotingOpen(room)) {
      closeVoting(io, room);
      emitError(socket, "VOTING_CLOSED", "Voting has ended.");
      return;
    }

    if (!room.round.participantIds.includes(guestId) || !room.players.get(guestId)?.connected) {
      emitError(socket, "VOTER_NOT_ACTIVE", "Only active round players can vote.");
      return;
    }

    if (guestId === targetGuestId) {
      emitError(socket, "SELF_VOTE_BLOCKED", "You cannot vote for your own drawing.");
      return;
    }

    if (room.round.voting.votes.has(guestId)) {
      emitError(socket, "VOTE_ALREADY_CAST", "Your vote was already submitted.");
      return;
    }

    if (!room.round.submissions.has(targetGuestId)) {
      emitError(socket, "DRAWING_NOT_FOUND", "Vote for a submitted drawing.");
      return;
    }

    room.round.voting.votes.set(guestId, targetGuestId);
    emitVoteProgress(io, room, guestId);
    emitRoom(io, room);

    if (room.round.voting.votes.size >= expectedVoters(room).length) {
      closeVoting(io, room);
    }
  });

  socket.on("round:next", ({ roomCode, guestId }) => {
    const room = rooms.get(String(roomCode || "").trim().toUpperCase());

    if (!room) {
      emitError(socket, "ROOM_NOT_FOUND", "That room does not exist.");
      return;
    }

    if (room.hostId !== guestId) {
      emitError(socket, "HOST_ONLY", "Only the host can continue the match.");
      return;
    }

    if (room.phase !== "leaderboard" && room.phase !== "ended") {
      emitError(socket, "ROUND_NOT_READY", "The round is not ready to continue.");
      return;
    }

    advanceRound(io, room);
  });

  socket.on("room:leave", () => {
    leaveCurrentRoom(io, socket, { immediate: true });
    socket.data.roomCode = null;
    socket.data.guestId = null;
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(io, socket);
  });
});

httpServer.listen(port, () => {
  console.log(
    `> Cascade Chaos server listening at http://localhost:${port} as ${
      dev ? "development" : "production"
    }`,
  );
});
