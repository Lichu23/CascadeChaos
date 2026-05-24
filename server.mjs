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
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    settings: room.settings,
    players: Array.from(room.players.values()).map((player) => ({
      guestId: player.guestId,
      username: player.username,
      score: player.score,
      connected: player.connected,
      isHost: player.guestId === room.hostId,
      joinedAt: player.joinedAt,
    })),
  };
}

function activePlayers(room) {
  return Array.from(room.players.values()).filter((player) => player.connected);
}

function emitRoom(io, room) {
  io.to(room.code).emit("room:state", publicRoom(room));
}

function emitError(socket, code, message) {
  socket.emit("room:error", { code, message });
}

function reassignHost(room) {
  if (room.hostId && room.players.get(room.hostId)?.connected) {
    return;
  }

  room.hostId = activePlayers(room)[0]?.guestId ?? null;
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
    existingPlayer.lastSeenAt = Date.now();
  } else {
    room.players.set(guestId, {
      guestId,
      username,
      socketId: socket.id,
      connected: true,
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

function leaveCurrentRoom(io, socket) {
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
    player.lastSeenAt = Date.now();
  }

  socket.leave(roomCode);
  reassignHost(room);

  if (activePlayers(room).length === 0) {
    scheduleRoomCleanup(io, room);
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
    emitRoom(io, room);
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

    room.phase = "drawing";
    io.to(room.code).emit("game:started", publicRoom(room));
    emitRoom(io, room);
  });

  socket.on("room:leave", () => {
    leaveCurrentRoom(io, socket);
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
