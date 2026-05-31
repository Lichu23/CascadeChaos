"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { MultiplayerDrawingRound } from "@/components/game/MultiplayerDrawingRound";
import { MultiplayerReveal } from "@/components/game/MultiplayerReveal";
import { MultiplayerScorePlaceholder } from "@/components/game/MultiplayerScorePlaceholder";
import { MultiplayerVoting } from "@/components/game/MultiplayerVoting";
import { Modal } from "@/components/ui/Modal";
import { getGuestId, getStoredUsername } from "@/lib/guest/guest-id";
import { useNavigationWarning } from "@/lib/navigation/use-navigation-warning";
import { getSocket } from "@/lib/socket/client";
import type {
  PublicRoom,
  RoomClosedPayload,
  RoomError,
  StartBlockedPayload,
} from "@/types/room";

const MIN_PLAYERS_TO_START = 3;

type RoomLobbyProps = {
  roomCode: string;
};

function playerInitial(username: string) {
  return username.trim().slice(0, 1).toUpperCase() || "?";
}

function readyButtonClass(isReady: boolean) {
  return isReady
    ? "bg-emerald-500 text-white shadow-emerald-200"
    : "bg-indigo-50 text-indigo-800";
}

function readyStatusClass(isReady: boolean) {
  return isReady
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-white/70 text-slate-500";
}

export function RoomLobby({ roomCode }: RoomLobbyProps) {
  const router = useRouter();
  const [guestId, setGuestId] = useState("");
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);
  const [blockingError, setBlockingError] = useState<RoomError | null>(null);
  const [closedRoom, setClosedRoom] = useState<RoomClosedPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);

  const activePlayers = useMemo(
    () => room?.players.filter((player) => player.connected) ?? [],
    [room],
  );
  const currentPlayer = room?.players.find((player) => player.guestId === guestId);
  const isHost = currentPlayer?.isHost ?? false;
  const readyPlayers = activePlayers.filter((player) => player.ready);
  const isCurrentPlayerReady = currentPlayer?.ready ?? false;
  const hasEnoughPlayers = activePlayers.length >= MIN_PLAYERS_TO_START;
  const allReady = hasEnoughPlayers && readyPlayers.length === activePlayers.length;
  const isCountdown = room?.phase === "countdown";
  const isLobbyEditable = room?.phase === "lobby";
  const countdownEndsAt = room?.countdownEndsAt ?? null;

  useNavigationWarning({
    enabled: !closedRoom && !blockingError,
    message: "Leave this room? Going back or refreshing can disconnect you and may make the app reconnect when you return.",
  });

  useEffect(() => {
    if (!countdownEndsAt) {
      return;
    }

    const updateCountdown = () => {
      setCountdownSeconds(Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000)));
    };

    const timeout = window.setTimeout(updateCountdown, 0);
    const interval = window.setInterval(updateCountdown, 100);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [countdownEndsAt]);

  useEffect(() => {
    const storedName = getStoredUsername();

    if (!storedName) {
      router.replace("/join");
      return;
    }

    const localGuestId = getGuestId();
    const socket = getSocket();

    queueMicrotask(() => {
      setGuestId(localGuestId);
      setUsername(storedName);
      setConnected(socket.connected);
    });

    const handleConnect = () => {
      setConnected(true);
      socket.emit("room:join", {
        guestId: localGuestId,
        roomCode,
        username: storedName,
      });
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleRoomState = (nextRoom: PublicRoom) => {
      setBlockingError(null);
      setClosedRoom(null);
      setRoom(nextRoom);
    };

    const handleRoomError = (error: RoomError) => {
      if (error.code === "ROOM_NOT_FOUND" || error.code === "ROOM_ALREADY_STARTED") {
        setBlockingError(error);
        setRoom(null);
        return;
      }

      setModal({ title: "Room error", message: error.message });
    };

    const handleStartBlocked = (payload: StartBlockedPayload) => {
      setModal({ title: "Need more players", message: payload.message });
    };

    const handleRoomClosed = (payload: RoomClosedPayload) => {
      setClosedRoom(payload);
      setRoom(null);
      setModal(null);
      setBlockingError(null);
    };

    const handleStarted = (nextRoom: PublicRoom) => {
      setRoom(nextRoom);
      setModal(null);
    };

    const handleVotingStarted = ({ room: nextRoom }: { room: PublicRoom }) => {
      setRoom(nextRoom);
      setModal(null);
    };

    const handleRoundAdvanced = ({ room: nextRoom }: { room: PublicRoom }) => {
      setRoom(nextRoom);
      setModal(null);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:joined", handleRoomState);
    socket.on("room:state", handleRoomState);
    socket.on("room:error", handleRoomError);
    socket.on("room:closed", handleRoomClosed);
    socket.on("game:start-blocked", handleStartBlocked);
    socket.on("game:started", handleStarted);
    socket.on("voting:started", handleVotingStarted);
    socket.on("round:advanced", handleRoundAdvanced);

    socket.emit("room:join", {
      guestId: localGuestId,
      roomCode,
      username: storedName,
    });

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:joined", handleRoomState);
      socket.off("room:state", handleRoomState);
      socket.off("room:error", handleRoomError);
      socket.off("room:closed", handleRoomClosed);
      socket.off("game:start-blocked", handleStartBlocked);
      socket.off("game:started", handleStarted);
      socket.off("voting:started", handleVotingStarted);
      socket.off("round:advanced", handleRoundAdvanced);
    };
  }, [roomCode, router]);

  const updateSetting = (key: "roundTime" | "totalRounds") => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      if (!room || !guestId || !isHost || !isLobbyEditable) {
        return;
      }

      getSocket().emit("room:update-settings", {
        guestId,
        roomCode,
        settings: {
          ...room.settings,
          [key]: Number(event.target.value),
        },
      });
    };
  };

  const toggleReady = () => {
    if (!room || !guestId || !isLobbyEditable) {
      return;
    }

    getSocket().emit("room:set-ready", {
      guestId,
      ready: !isCurrentPlayerReady,
      roomCode,
    });
  };

  const leaveRoom = () => {
    getSocket().emit("room:leave");
  };

  const copyRoomCode = async () => {
    if (copiedRoomCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedRoomCode(true);
      window.setTimeout(() => setCopiedRoomCode(false), 2_000);
    } catch {
      setModal({ title: "Copy failed", message: "Copy the room code manually." });
    }
  };

  const closeRoomClosedMessage = () => {
    setClosedRoom(null);
    router.replace("/join");
  };

  if (closedRoom) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 px-4 py-10 text-center text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-6 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
          <p className="text-sm font-black uppercase text-pink-500">Match paused</p>
          <h1 className="mt-3 text-4xl font-black text-indigo-950">
            Host abandoned room
          </h1>
          <p className="mt-3 leading-7 text-slate-600">{closedRoom.message}</p>
          <button
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-indigo-500 px-6 text-sm font-black text-white shadow-lg shadow-indigo-300 transition hover:bg-indigo-600 active:scale-[0.98]"
            onClick={closeRoomClosedMessage}
            type="button"
          >
            Home
          </button>
        </section>
      </main>
    );
  }

  if (room?.phase === "drawing" && room.round && guestId) {
    return (
      <MultiplayerDrawingRound
        guestId={guestId}
        key={`${room.code}-${room.round.number}-${room.round.challengeId}`}
        room={room}
      />
    );
  }

  if (room?.phase === "reveal" && room.round) {
    return (
      <MultiplayerReveal
        key={`${room.code}-${room.round.number}-reveal`}
        room={room}
      />
    );
  }

  if (room?.phase === "voting" && room.round && guestId) {
    return (
      <MultiplayerVoting
        guestId={guestId}
        key={`${room.code}-${room.round.number}-voting`}
        room={room}
      />
    );
  }

  if (
    (room?.phase === "leaderboard" ||
      room?.phase === "ended" ||
      room?.phase === "interrupted") &&
    guestId
  ) {
    return <MultiplayerScorePlaceholder guestId={guestId} room={room} />;
  }

  if (blockingError) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 px-4 py-10 text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-5 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
          <p className="text-sm font-bold uppercase text-pink-500">Room unavailable</p>
          <h1 className="mt-2 text-4xl font-black text-indigo-950">{roomCode}</h1>
          <p className="mt-3 leading-7 text-slate-600">{blockingError.message}</p>
          <Link
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-indigo-500 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-300 transition hover:bg-indigo-600 active:scale-[0.98]"
            href="/join"
          >
            Create or Join Room
          </Link>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 px-4 py-6 text-slate-900">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          <header className="flex items-center justify-between">
            <Link
              className="text-sm font-bold text-indigo-700 transition hover:text-indigo-900"
              href="/join"
              onClick={leaveRoom}
            >
              Leave
            </Link>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                connected
                  ? "bg-emerald-100 text-emerald-700"
                  : "animate-pulse bg-pink-500 text-white"
              }`}
            >
              {connected ? "Connected" : "Reconnecting"}
            </span>
          </header>

          <section className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
            <div>
              <div>
                <p className="text-sm font-bold uppercase text-slate-500">Room code</p>
                <div className="mt-1 flex items-center gap-3">
                  <h1 className="min-w-0 text-5xl font-black tracking-normal text-indigo-700">
                    {roomCode}
                  </h1>
                  <button
                    aria-label={copiedRoomCode ? "Room code copied" : "Copy room code"}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-emerald-100 disabled:text-emerald-700"
                    disabled={copiedRoomCode}
                    onClick={copyRoomCode}
                    title={copiedRoomCode ? "Copied" : "Copy room code"}
                    type="button"
                  >
                    {copiedRoomCode ? (
                      <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.75"
                        viewBox="0 0 24 24"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.25"
                        viewBox="0 0 24 24"
                      >
                        <rect height="14" rx="2" ry="2" width="14" x="8" y="8" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Signed in as {username || "guest"}
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-700">
                Players ({activePlayers.length}/8)
              </h2>
              {!hasEnoughPlayers ? (
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">
                  Min 3 players
                </span>
              ) : isCountdown ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700">
                  All ready
                </span>
              ) : readyPlayers.length < activePlayers.length ? (
                <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                  {readyPlayers.length}/{activePlayers.length} ready
                </span>
              ) : (
                <span className="animate-pulse rounded-full bg-pink-500 px-3 py-1.5 text-xs font-black text-white">
                  Starting
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3">
              {(room?.players ?? []).map((player) => {
                const isCurrentPlayer = player.guestId === guestId;

                return (
                  <article
                    className={`flex items-center justify-between gap-3 rounded-3xl border px-4 py-3 ${
                      isCurrentPlayer
                        ? "border-indigo-200 bg-white"
                        : "border-indigo-100 bg-indigo-50/60"
                    }`}
                    key={player.guestId}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-lg font-black text-indigo-700">
                        {playerInitial(player.username)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-black text-indigo-950">
                          {isCurrentPlayer ? "You" : player.username}
                          {player.isHost ? " - Host" : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {player.connected ? "Connected" : "Disconnected"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isCurrentPlayer ? (
                        <button
                          className={`min-h-9 rounded-xl px-4 py-2 text-xs font-black uppercase shadow transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${readyButtonClass(player.ready)}`}
                          disabled={!hasEnoughPlayers || !isLobbyEditable}
                          onClick={toggleReady}
                          type="button"
                        >
                          {player.ready ? "Ready" : "Ready up"}
                        </button>
                      ) : (
                        <span
                          aria-label={`${player.username} is ${
                            player.ready ? "ready" : "not ready"
                          }`}
                          className={`inline-flex min-h-9 items-center rounded-xl border px-4 py-2 text-xs font-black uppercase ${readyStatusClass(player.ready)}`}
                        >
                          {player.ready ? "Ready" : "Not ready"}
                        </span>
                      )}
                      <span
                        className={`h-3 w-3 rounded-full ${
                          player.connected ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                    </div>
                  </article>
                );
              })}

              {!room ? (
                <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4 text-slate-500">
                  Joining room...
                </div>
              ) : null}
            </div>

            {isCountdown ? (
              <div className="mt-6 text-center">
                <p className="text-sm font-black uppercase text-pink-500">Starting in</p>
                <p className="mt-1 text-7xl font-black tabular-nums text-pink-500">
                  {countdownSeconds}
                </p>
              </div>
            ) : allReady ? (
              <div className="mt-6 text-center">
                <p className="text-sm font-black uppercase text-pink-500">Ready</p>
                <p className="mt-1 text-3xl font-black text-pink-500">Countdown starting</p>
              </div>
            ) : null}

            <aside className="mt-6 border-t border-indigo-100 pt-5">
              <h2 className="text-lg font-black text-slate-700">Settings</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isHost ? "Host controls are active." : "Only the host can change settings."}
              </p>

              <div className="mt-5 grid gap-5">
                <label className="grid gap-2 text-sm font-bold text-slate-600">
                  Round timer: {room?.settings.roundTime ?? 90}s
                  <input
                    className="accent-indigo-500"
                    disabled={!isHost || !room || !isLobbyEditable}
                    max="180"
                    min="30"
                    onChange={updateSetting("roundTime")}
                    step="15"
                    type="range"
                    value={room?.settings.roundTime ?? 90}
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-slate-600">
                  Total rounds: {room?.settings.totalRounds ?? 3}
                  <input
                    className="accent-indigo-500"
                    disabled={!isHost || !room || !isLobbyEditable}
                    max="10"
                    min="1"
                    onChange={updateSetting("totalRounds")}
                    type="range"
                    value={room?.settings.totalRounds ?? 3}
                  />
                </label>
              </div>
            </aside>
          </section>
        </div>
      </main>

      {modal ? (
        <Modal
          message={modal.message}
          onClose={() => setModal(null)}
          title={modal.title}
        />
      ) : null}
    </>
  );
}
