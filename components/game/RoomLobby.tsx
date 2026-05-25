"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { MultiplayerDrawingRound } from "@/components/game/MultiplayerDrawingRound";
import { MultiplayerReveal } from "@/components/game/MultiplayerReveal";
import { MultiplayerScorePlaceholder } from "@/components/game/MultiplayerScorePlaceholder";
import { MultiplayerVoting } from "@/components/game/MultiplayerVoting";
import { getGuestId, getStoredUsername } from "@/lib/guest/guest-id";
import { getSocket } from "@/lib/socket/client";
import type { PublicRoom, RoomError, StartBlockedPayload } from "@/types/room";

const MIN_PLAYERS_TO_START = 3;

type RoomLobbyProps = {
  roomCode: string;
};

export function RoomLobby({ roomCode }: RoomLobbyProps) {
  const router = useRouter();
  const [guestId, setGuestId] = useState("");
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);
  const [blockingError, setBlockingError] = useState<RoomError | null>(null);
  const [connected, setConnected] = useState(false);

  const activePlayers = useMemo(
    () => room?.players.filter((player) => player.connected) ?? [],
    [room],
  );
  const currentPlayer = room?.players.find((player) => player.guestId === guestId);
  const isHost = currentPlayer?.isHost ?? false;
  const readyPlayers = activePlayers.filter((player) => player.ready);
  const isCurrentPlayerReady = currentPlayer?.ready ?? false;
  const hasEnoughPlayers = activePlayers.length >= MIN_PLAYERS_TO_START;

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
      socket.off("game:start-blocked", handleStartBlocked);
      socket.off("game:started", handleStarted);
      socket.off("voting:started", handleVotingStarted);
      socket.off("round:advanced", handleRoundAdvanced);
    };
  }, [roomCode, router]);

  const updateSetting = (key: "roundTime" | "totalRounds") => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      if (!room || !guestId || !isHost) {
        return;
      }

      const settings = {
        ...room.settings,
        [key]: Number(event.target.value),
      };

      getSocket().emit("room:update-settings", {
        guestId,
        roomCode,
        settings,
      });
    };
  };

  const toggleReady = () => {
    if (!room || !guestId) {
      return;
    }

    getSocket().emit("room:set-ready", {
      guestId,
      ready: !isCurrentPlayerReady,
      roomCode,
    });
  };

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

  if ((room?.phase === "leaderboard" || room?.phase === "ended") && guestId) {
    return <MultiplayerScorePlaceholder guestId={guestId} room={room} />;
  }

  if (blockingError) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 py-10 text-zinc-50">
        <section className="w-full max-w-md rounded-md border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm font-semibold uppercase text-amber-300">Room unavailable</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-50">{roomCode}</h1>
          <p className="mt-3 leading-7 text-zinc-300">{blockingError.message}</p>
          <Link
            className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
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
      <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-50 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-emerald-300">
                Room lobby
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal text-zinc-50">
                {roomCode}
              </h1>
              <p className="mt-2 text-zinc-400">
                Signed in as {username || "guest"} · {connected ? "connected" : "reconnecting"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-800 px-4 text-sm font-semibold text-zinc-50 transition hover:bg-zinc-700"
                href="/join"
              >
                Join Another
              </Link>
            </div>
          </header>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Players</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {activePlayers.length}/{MIN_PLAYERS_TO_START} active players required · {readyPlayers.length}/{activePlayers.length} ready
                  </p>
                </div>
                {!hasEnoughPlayers ? (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200">
                    Need at least 3 players
                  </span>
                ) : readyPlayers.length < activePlayers.length ? (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200">
                    Waiting for ready
                  </span>
                ) : (
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200">
                    Starting game
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                {(room?.players ?? []).map((player) => (
                  <article
                    className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3"
                    key={player.guestId}
                  >
                    <div>
                      <p className="font-semibold text-zinc-50">
                        {player.username}
                        {player.guestId === guestId ? " (you)" : ""}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {player.connected ? "Connected" : "Disconnected"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {player.isHost ? (
                        <span className="rounded bg-emerald-400 px-2 py-1 text-xs font-bold uppercase text-zinc-950">
                          Host
                        </span>
                      ) : null}
                      {player.guestId === guestId ? (
                        <Button
                          className="h-8 px-3 text-xs"
                          disabled={!hasEnoughPlayers}
                          onClick={toggleReady}
                          variant={player.ready ? "primary" : "secondary"}
                        >
                          {player.ready ? "Ready" : "Not Ready"}
                        </Button>
                      ) : player.ready ? (
                        <span className="rounded bg-sky-400 px-2 py-1 text-xs font-bold uppercase text-zinc-950">
                          Ready
                        </span>
                      ) : (
                        <span className="rounded border border-zinc-700 px-2 py-1 text-xs font-bold uppercase text-zinc-400">
                          Not ready
                        </span>
                      )}
                    </div>
                  </article>
                ))}

                {!room ? (
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 text-zinc-400">
                    Joining room...
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="text-xl font-semibold">Settings</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {isHost ? "Host controls are active." : "Only the host can change settings."}
              </p>

              <div className="mt-5 grid gap-5">
                <label className="grid gap-2 text-sm font-medium text-zinc-300">
                  Round timer: {room?.settings.roundTime ?? 90}s
                  <input
                    className="accent-emerald-400"
                    disabled={!isHost || !room}
                    max="180"
                    min="30"
                    onChange={updateSetting("roundTime")}
                    step="15"
                    type="range"
                    value={room?.settings.roundTime ?? 90}
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-zinc-300">
                  Total rounds: {room?.settings.totalRounds ?? 3}
                  <input
                    className="accent-emerald-400"
                    disabled={!isHost || !room}
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
