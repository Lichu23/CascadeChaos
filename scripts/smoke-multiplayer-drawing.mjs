import { io } from "socket.io-client";

const serverUrl = process.env.SMOKE_SERVER_URL ?? "http://localhost:3000";
const drawingDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

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

function waitForRoomState(socket, predicate, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for matching room state"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("room:state", handleState);
      socket.off("room:error", handleError);
    };

    const handleState = (room) => {
      if (!predicate(room)) {
        return;
      }

      cleanup();
      resolve(room);
    };

    const handleError = (error) => {
      cleanup();
      reject(new Error(error.message));
    };

    socket.on("room:state", handleState);
    socket.once("room:error", handleError);
  });
}

function waitForEvent(socket, event, predicate, timeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for matching ${event}`));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(event, handleEvent);
      socket.off("room:error", handleError);
    };

    const handleEvent = (payload) => {
      if (!predicate(payload)) {
        return;
      }

      cleanup();
      resolve(payload);
    };

    const handleError = (error) => {
      cleanup();
      reject(new Error(error.message));
    };

    socket.on(event, handleEvent);
    socket.once("room:error", handleError);
  });
}

function waitForSubmission(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for matching submission progress"));
    }, 5_000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("drawing:submitted", handleSubmission);
      socket.off("room:error", handleError);
    };

    const handleSubmission = (payload) => {
      if (!predicate(payload)) {
        return;
      }

      cleanup();
      resolve(payload);
    };

    const handleError = (error) => {
      cleanup();
      reject(new Error(error.message));
    };

    socket.on("drawing:submitted", handleSubmission);
    socket.once("room:error", handleError);
  });
}

async function expectRoomError(socket, code) {
  const error = await once(socket, "room:error");

  if (error.code !== code) {
    throw new Error(`Expected ${code}, received ${error.code}.`);
  }
}

function draftAllDrawings({ host, playerTwo, playerThree, roomCode }) {
  host.emit("drawing:draft", {
    guestId: "guest-host",
    roomCode,
    dataUrl: drawingDataUrl,
  });
  playerTwo.emit("drawing:draft", {
    guestId: "guest-two",
    roomCode,
    dataUrl: drawingDataUrl,
  });
  playerThree.emit("drawing:draft", {
    guestId: "guest-three",
    roomCode,
    dataUrl: drawingDataUrl,
  });
}

async function waitForReveal(socket, roomCode, timeoutMs = 5_000) {
  const room = await waitForRoomState(
    socket,
    (nextRoom) =>
      nextRoom.code === roomCode &&
      nextRoom.phase === "reveal" &&
      nextRoom.round?.submissionCount === 3 &&
      !nextRoom.round.isSubmissionOpen,
    timeoutMs,
  );

  if (room.round?.submissions.length !== 3) {
    throw new Error("Expected reveal to include three submitted drawings.");
  }

  return room;
}

async function waitForVoting(socket) {
  const votingStarted = await waitForEvent(
    socket,
    "voting:started",
    (payload) => payload.room.phase === "voting",
    12_000,
  );

  if (votingStarted.room.phase !== "voting" || !votingStarted.room.round?.voting?.isVotingOpen) {
    throw new Error("Expected automatic voting to start from reveal.");
  }

  return votingStarted.room;
}

async function castStandardVotes({ host, playerTwo, playerThree, roomCode }) {
  host.emit("vote:cast", {
    guestId: "guest-host",
    roomCode,
    targetGuestId: "guest-two",
  });
  await once(host, "vote:cast");

  playerTwo.emit("vote:cast", {
    guestId: "guest-two",
    roomCode,
    targetGuestId: "guest-host",
  });
  await once(playerTwo, "vote:cast");

  playerThree.emit("vote:cast", {
    guestId: "guest-three",
    roomCode,
    targetGuestId: "guest-host",
  });
  await once(playerThree, "vote:cast");
}

async function readyAllPlayers({ host, playerTwo, playerThree, roomCode }) {
  host.emit("room:set-ready", {
    guestId: "guest-host",
    ready: true,
    roomCode,
  });
  await waitForRoomState(host, (room) => room.players.find((player) => player.guestId === "guest-host")?.ready);

  playerTwo.emit("room:set-ready", {
    guestId: "guest-two",
    ready: true,
    roomCode,
  });
  await waitForRoomState(playerTwo, (room) => room.players.find((player) => player.guestId === "guest-two")?.ready);

  playerThree.emit("room:set-ready", {
    guestId: "guest-three",
    ready: true,
    roomCode,
  });
}

const host = createClient("host");
const playerTwo = createClient("playerTwo");
const playerThree = createClient("playerThree");

try {
  host.emit("room:create", { guestId: "guest-host", username: "Host" });
  const createdRoom = await once(host, "room:joined");

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

  host.emit("room:update-settings", {
    guestId: "guest-host",
      roomCode: createdRoom.code,
      settings: {
      roundTime: 30,
      totalRounds: 2,
    },
  });
  await waitForRoomState(host, (room) => room.settings.totalRounds === 2);

  await readyAllPlayers({ host, playerTwo, playerThree, roomCode: createdRoom.code });
  const started = await once(host, "game:started");

  if (started.phase !== "drawing" || !started.round) {
    throw new Error("Expected game to start with an active drawing round.");
  }

  if (!started.round.challengeId || started.round.expectedSubmissions !== 3) {
    throw new Error("Expected drawing round to include a challenge and three submissions.");
  }

  host.emit("drawing:submit", {
    guestId: "guest-host",
    roomCode: createdRoom.code,
    dataUrl: drawingDataUrl,
  });
  const firstSubmission = await waitForSubmission(
    host,
    (payload) => payload.guestId === "guest-host" && payload.submissionCount === 1,
  );

  if (firstSubmission.submissionCount !== 1) {
    throw new Error("Expected first drawing submission to be counted.");
  }

  host.emit("drawing:submit", {
    guestId: "guest-host",
    roomCode: createdRoom.code,
    dataUrl: drawingDataUrl,
  });
  await expectRoomError(host, "DRAWING_ALREADY_SUBMITTED");

  playerTwo.emit("drawing:submit", {
    guestId: "guest-two",
    roomCode: createdRoom.code,
    dataUrl: drawingDataUrl,
  });
  await waitForSubmission(
    playerTwo,
    (payload) => payload.guestId === "guest-two" && payload.submissionCount === 2,
  );

  playerThree.emit("drawing:submit", {
    guestId: "guest-three",
    roomCode: createdRoom.code,
    dataUrl: drawingDataUrl,
  });
  const finalSubmission = await waitForSubmission(
    playerThree,
    (payload) => payload.guestId === "guest-three" && payload.submissionCount === 3,
  );
  const closedRoom = await waitForReveal(playerThree, createdRoom.code);

  if (
    finalSubmission.submissionCount !== 3 ||
    closedRoom.phase !== "reveal" ||
    closedRoom.round?.isSubmissionOpen ||
    closedRoom.round?.submissions.length !== 3
  ) {
    throw new Error("Expected drawing round to reveal after all players submit.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomCode: createdRoom.code,
        revealPhase: closedRoom.phase,
        challengeId: closedRoom.round.challengeId,
        submissions: closedRoom.round.submissionCount,
        revealedDrawings: closedRoom.round.submissions.length,
        isSubmissionOpen: closedRoom.round.isSubmissionOpen,
      },
      null,
      2,
    ),
  );

  await waitForVoting(host);

  host.emit("vote:cast", {
    guestId: "guest-host",
    roomCode: createdRoom.code,
    targetGuestId: "guest-host",
  });
  await expectRoomError(host, "SELF_VOTE_BLOCKED");

  host.emit("vote:cast", {
    guestId: "guest-host",
    roomCode: createdRoom.code,
    targetGuestId: "guest-two",
  });
  await once(host, "vote:cast");

  host.emit("vote:cast", {
    guestId: "guest-host",
    roomCode: createdRoom.code,
    targetGuestId: "guest-three",
  });
  await expectRoomError(host, "VOTE_ALREADY_CAST");

  playerTwo.emit("vote:cast", {
    guestId: "guest-two",
    roomCode: createdRoom.code,
    targetGuestId: "guest-host",
  });
  await once(playerTwo, "vote:cast");

  playerThree.emit("vote:cast", {
    guestId: "guest-three",
    roomCode: createdRoom.code,
    targetGuestId: "guest-host",
  });
  await once(playerThree, "vote:cast");

  const scoredRoom = await waitForRoomState(
    playerThree,
    (room) => room.phase === "leaderboard",
  );
  const hostScore = scoredRoom.players.find((player) => player.guestId === "guest-host")?.score;
  const playerTwoScore = scoredRoom.players.find((player) => player.guestId === "guest-two")?.score;

  if (hostScore !== 2 || playerTwoScore !== 1) {
    throw new Error("Expected votes to convert into player scores.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomCode: createdRoom.code,
        finalPhase: scoredRoom.phase,
        round: scoredRoom.round.number,
        scores: scoredRoom.players.map((player) => ({
          username: player.username,
          score: player.score,
        })),
      },
      null,
      2,
    ),
  );

  host.emit("round:next", { guestId: "guest-host", roomCode: createdRoom.code });
  const roundTwo = await waitForEvent(
    host,
    "round:advanced",
    (payload) => payload.room.phase === "drawing" && payload.room.round?.number === 2,
  );

  if (roundTwo.room.round.challengeId === closedRoom.round.challengeId) {
    throw new Error("Expected next round to use a different challenge.");
  }

  draftAllDrawings({ host, playerTwo, playerThree, roomCode: createdRoom.code });
  await waitForReveal(playerThree, createdRoom.code, 35_000);
  await waitForVoting(host);
  await castStandardVotes({ host, playerTwo, playerThree, roomCode: createdRoom.code });

  const finalRoom = await waitForRoomState(
    playerThree,
    (room) => room.phase === "ended" && room.round?.number === 2,
  );

  if (finalRoom.round?.totalRounds !== 2) {
    throw new Error("Expected the game to end after the configured final round.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomCode: createdRoom.code,
        finalPhase: finalRoom.phase,
        round: finalRoom.round.number,
        scores: finalRoom.players.map((player) => ({
          username: player.username,
          score: player.score,
        })),
      },
      null,
      2,
    ),
  );

  if (finalRoom.round.submissions.length !== 3) {
    throw new Error("Expected submitted drawings to be available in the final round.");
  }

  playerTwo.emit("game:return-lobby", {
    guestId: "guest-two",
    roomCode: createdRoom.code,
  });
  const waitingReturnRoom = await waitForRoomState(
    playerTwo,
    (room) =>
      room.phase === "ended" &&
      room.players.find((player) => player.guestId === "guest-two")?.returnedToLobby === true,
  );

  if (waitingReturnRoom.phase !== "ended") {
    throw new Error("Expected one returned player to keep the room on the final screen.");
  }

  host.emit("game:return-lobby", {
    guestId: "guest-host",
    roomCode: createdRoom.code,
  });
  await waitForRoomState(
    host,
    (room) =>
      room.phase === "ended" &&
      room.players.find((player) => player.guestId === "guest-host")?.returnedToLobby === true,
  );

  playerThree.emit("game:return-lobby", {
    guestId: "guest-three",
    roomCode: createdRoom.code,
  });
  const lobbyRoom = await waitForRoomState(
    playerTwo,
    (room) =>
      room.phase === "lobby" &&
      room.round === null &&
      room.players.every((player) => !player.ready && player.score === 0),
  );

  if (lobbyRoom.players.length !== 3) {
    throw new Error("Expected all players to return to the lobby room.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        roomCode: createdRoom.code,
        phase: lobbyRoom.phase,
        players: lobbyRoom.players.map((player) => ({
          username: player.username,
          ready: player.ready,
          score: player.score,
        })),
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
