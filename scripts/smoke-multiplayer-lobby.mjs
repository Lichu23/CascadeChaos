import { io } from "socket.io-client";

const serverUrl = process.env.SMOKE_SERVER_URL ?? "http://localhost:3000";

function createClient(name) {
  const socket = io(serverUrl, {
    autoConnect: false,
    reconnection: false,
    timeout: 5_000,
  });

  socket.on("connect_error", (error) => {
    throw new Error(`${name} failed to connect: ${error.message}`);
  });

  socket.connect();
  return socket;
}

function once(socket, event) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${event}`));
    }, 5_000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(event, handleEvent);
      socket.off("room:error", handleError);
    };

    const handleEvent = (payload) => {
      cleanup();
      resolve(payload);
    };

    const handleError = (error) => {
      cleanup();
      reject(new Error(error.message));
    };

    socket.once(event, handleEvent);
    socket.once("room:error", handleError);
  });
}

const host = createClient("host");
const playerTwo = createClient("playerTwo");
const playerThree = createClient("playerThree");

try {
  host.emit("room:create", { guestId: "guest-host", username: "Host" });
  const createdRoom = await once(host, "room:joined");

  host.emit("game:start", { guestId: "guest-host", roomCode: createdRoom.code });
  const blocked = await once(host, "game:start-blocked");

  if (blocked.minPlayers !== 3 || blocked.activePlayers !== 1) {
    throw new Error("Expected start to be blocked with one active player.");
  }

  playerTwo.emit("room:join", {
    guestId: "guest-two",
    roomCode: createdRoom.code,
    username: "Player Two",
  });
  await once(playerTwo, "room:joined");

  playerThree.emit("room:join", {
    guestId: "guest-three",
    roomCode: createdRoom.code,
    username: "Player Three",
  });
  await once(playerThree, "room:joined");

  host.emit("game:start", { guestId: "guest-host", roomCode: createdRoom.code });
  const started = await once(host, "game:started");

  if (started.phase !== "drawing" || started.players.length !== 3) {
    throw new Error("Expected game to start with three players.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomCode: createdRoom.code,
        phase: started.phase,
        players: started.players.map((player) => player.username),
      },
      null,
      2,
    ),
  );
} finally {
  host.close();
  playerTwo.close();
  playerThree.close();
}

