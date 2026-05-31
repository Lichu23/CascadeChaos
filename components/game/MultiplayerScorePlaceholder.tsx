"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { getSocket } from "@/lib/socket/client";
import type { PublicRoom } from "@/types/room";

type MultiplayerScorePlaceholderProps = {
  guestId: string;
  room: PublicRoom;
};

export function MultiplayerScorePlaceholder({ guestId, room }: MultiplayerScorePlaceholderProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const sortedPlayers = useMemo(
    () => [...room.players].sort((left, right) => right.score - left.score || left.username.localeCompare(right.username)),
    [room.players],
  );
  const highestScore = sortedPlayers[0]?.score ?? 0;
  const winners = sortedPlayers.filter((player) => player.score === highestScore);
  const isHost = room.hostId === guestId;
  const round = room.round;
  const isGameOver = room.phase === "ended";
  const isInterrupted = room.phase === "interrupted";
  const currentPlayer = room.players.find((player) => player.guestId === guestId);
  const hasReturnedToLobby = currentPlayer?.returnedToLobby ?? false;

  useEffect(() => {
    if (!round?.leaderboardEndsAt || isGameOver || isInterrupted) {
      return;
    }

    const leaderboardEndsAt = round.leaderboardEndsAt;
    const updateSeconds = () => {
      setSecondsLeft(Math.max(0, Math.ceil((leaderboardEndsAt - Date.now()) / 1000)));
    };

    updateSeconds();
    const interval = window.setInterval(updateSeconds, 250);

    return () => window.clearInterval(interval);
  }, [isGameOver, isInterrupted, round?.leaderboardEndsAt]);

  const continueMatch = () => {
    getSocket().emit("round:next", {
      guestId,
      roomCode: room.code,
    });
  };

  const returnToLobby = () => {
    getSocket().emit("game:return-lobby", {
      guestId,
      roomCode: room.code,
    });
  };

  const leaveRoom = () => {
    getSocket().emit("room:leave");
  };

  if (isInterrupted) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 px-4 py-10 text-center text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-6 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
          <p className="text-sm font-black uppercase text-pink-500">Match paused</p>
          <h1 className="mt-3 text-4xl font-black text-indigo-950">
            Match paused
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            {room.interruptedReason ?? "The match is paused because the host left the room."}
          </p>
          <Link
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-indigo-500 px-6 text-sm font-black text-white shadow-lg shadow-indigo-300 transition hover:bg-indigo-600 active:scale-[0.98]"
            href="/join"
            onClick={leaveRoom}
          >
            Home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8">
        <header className="text-center">
          <div>
            <p className={`inline-flex rounded-full px-4 py-1.5 text-xs font-black uppercase ${
              isInterrupted ? "bg-amber-400 text-amber-950" : "bg-amber-400 text-indigo-950"
            }`}>
              Room {room.code} / {isInterrupted ? "Match stopped" : isGameOver ? "Game over" : "Round results"}
            </p>
            <h1 className="mt-4 text-4xl font-black text-indigo-950 sm:text-5xl">
              {isInterrupted
                ? "Match stopped"
                : isGameOver
                  ? "Chaos champion"
                  : `Round ${round?.number ?? 1} results`}
            </h1>
            <p className="mt-2 text-slate-600">
              {isInterrupted
                ? room.interruptedReason ?? "The match stopped because there are not enough active players."
                : isGameOver
                ? winners.length > 1
                  ? "The match ended in a tie."
                  : `${winners[0]?.username ?? "Winner"} wins the match.`
                : "Votes are counted. The next round starts automatically."}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {round ? (
              <div className="min-w-36 rounded-full bg-white px-4 py-3">
                <p className="text-xs font-bold uppercase text-slate-500">Round</p>
                <p className="text-lg font-black text-indigo-950">
                  {round.number}/{round.totalRounds}
                </p>
              </div>
            ) : null}
            {!isGameOver && !isInterrupted ? (
              <div className="min-w-32 rounded-full bg-white px-4 py-3 text-right">
                <p className="text-xs font-bold uppercase text-slate-500">Next round</p>
                <p className="text-2xl font-black tabular-nums text-indigo-950">
                  {secondsLeft}s
                </p>
              </div>
            ) : null}
            {!isGameOver && !isInterrupted && isHost ? (
              <Button onClick={continueMatch} variant="secondary">Skip Wait</Button>
            ) : null}
            {isGameOver || isInterrupted ? (
              <Button disabled={hasReturnedToLobby} onClick={returnToLobby}>
                {hasReturnedToLobby ? "Waiting" : "Return to Lobby"}
              </Button>
            ) : null}
          </div>
        </header>

        {isGameOver || isInterrupted ? (
          <section
            className={`rounded-3xl border-4 bg-white p-6 text-center shadow-[0_25px_60px_rgba(79,70,229,0.15)] ${
              isInterrupted
                ? "border-amber-300"
                : "border-pink-300"
            }`}
          >
            <h2 className="text-sm font-black uppercase text-amber-600">
              {isInterrupted ? "Room needs players" : winners.length > 1 ? "Shared winners" : "Winner"}
            </h2>
            <p className="mt-3 text-4xl font-black text-indigo-950">
              {isInterrupted
                ? `${room.players.filter((player) => player.connected).length} connected`
                : winners.map((winner) => winner.username).join(", ")}
            </p>
          </section>
        ) : null}

        <section className="grid gap-5">
          <div className="rounded-3xl border border-indigo-100 bg-white p-4 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
            <h2 className="text-xl font-black text-indigo-950">Vote results</h2>
            <div className="mt-4 grid gap-3">
              {(round?.results ?? []).map((result) => (
                <article
                  className="flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3"
                  key={result.guestId}
                >
                  <p className="font-black text-indigo-950">{result.username}</p>
                  <p className="text-lg font-black text-pink-500">
                    {result.votes} {result.votes === 1 ? "vote" : "votes"}
                  </p>
                </article>
              ))}
              {(round?.results ?? []).length === 0 ? (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-slate-500">
                  No drawings received votes this round.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="rounded-3xl border border-indigo-100 bg-white p-4 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
            <h2 className="text-xl font-black text-indigo-950">Leaderboard</h2>
            <div className="mt-4 grid gap-3">
              {sortedPlayers.map((player, index) => (
                <article
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
                    index === 0
                      ? "border border-amber-300 bg-amber-50"
                      : "bg-indigo-50/60"
                  }`}
                  key={player.guestId}
                >
                  <div>
                    <p className="font-black text-indigo-950">
                      {index + 1}. {player.username}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isGameOver && player.returnedToLobby
                        ? "Returned to lobby"
                        : isInterrupted && player.returnedToLobby
                          ? "Ready for lobby"
                        : player.connected
                          ? "Connected"
                          : "Disconnected"}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-indigo-700">{player.score}</p>
                </article>
              ))}
            </div>
          </aside>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-indigo-100 pt-4 text-sm text-slate-500">
          <span>
            {isGameOver
              ? "Return to the lobby to change settings and ready up again."
              : isInterrupted
                ? "Return to the lobby once the room has enough players again."
              : "Next round starts automatically."}
          </span>
          <Link
            className="font-bold text-indigo-700 hover:text-indigo-900"
            href="/join"
            onClick={leaveRoom}
          >
            Leave room
          </Link>
        </footer>
      </div>
    </main>
  );
}
