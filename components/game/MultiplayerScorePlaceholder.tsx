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
  const currentPlayer = room.players.find((player) => player.guestId === guestId);
  const hasReturnedToLobby = currentPlayer?.returnedToLobby ?? false;

  useEffect(() => {
    if (!round?.leaderboardEndsAt || isGameOver) {
      return;
    }

    const leaderboardEndsAt = round.leaderboardEndsAt;
    const updateSeconds = () => {
      setSecondsLeft(Math.max(0, Math.ceil((leaderboardEndsAt - Date.now()) / 1000)));
    };

    updateSeconds();
    const interval = window.setInterval(updateSeconds, 250);

    return () => window.clearInterval(interval);
  }, [isGameOver, round?.leaderboardEndsAt]);

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

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-300">
              Room {room.code} / {isGameOver ? "Game over" : "Round results"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              {isGameOver ? "Final scores" : `Round ${round?.number ?? 1} results`}
            </h1>
            <p className="mt-2 text-zinc-400">
              {isGameOver
                ? winners.length > 1
                  ? "The match ended in a tie."
                  : `${winners[0]?.username ?? "Winner"} wins the match.`
                : "Votes are counted. The next round starts automatically."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {round ? (
              <div className="min-w-36 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3">
                <p className="text-xs uppercase text-zinc-500">Round</p>
                <p className="text-lg font-semibold text-zinc-50">
                  {round.number}/{round.totalRounds}
                </p>
              </div>
            ) : null}
            {!isGameOver ? (
              <div className="min-w-32 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
                <p className="text-xs uppercase text-zinc-500">Next round</p>
                <p className="text-2xl font-semibold tabular-nums text-zinc-50">
                  {secondsLeft}s
                </p>
              </div>
            ) : null}
            {!isGameOver && isHost ? (
              <Button onClick={continueMatch} variant="secondary">Skip Wait</Button>
            ) : null}
            {isGameOver ? (
              <Button disabled={hasReturnedToLobby} onClick={returnToLobby}>
                {hasReturnedToLobby ? "Waiting" : "Return to Lobby"}
              </Button>
            ) : null}
          </div>
        </header>

        {isGameOver ? (
          <section className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
            <h2 className="text-xl font-semibold text-emerald-100">
              {winners.length > 1 ? "Shared winners" : "Winner"}
            </h2>
            <p className="mt-2 text-2xl font-semibold text-zinc-50">
              {winners.map((winner) => winner.username).join(", ")}
            </p>
          </section>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="text-xl font-semibold">Vote results</h2>
            <div className="mt-4 grid gap-3">
              {(round?.results ?? []).map((result) => (
                <article
                  className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3"
                  key={result.guestId}
                >
                  <p className="font-semibold text-zinc-50">{result.username}</p>
                  <p className="text-lg font-semibold text-emerald-300">
                    {result.votes} {result.votes === 1 ? "vote" : "votes"}
                  </p>
                </article>
              ))}
              {(round?.results ?? []).length === 0 ? (
                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 text-zinc-400">
                  No drawings received votes this round.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="text-xl font-semibold">Leaderboard</h2>
            <div className="mt-4 grid gap-3">
              {sortedPlayers.map((player, index) => (
                <article
                  className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3"
                  key={player.guestId}
                >
                  <div>
                    <p className="font-semibold text-zinc-50">
                      {index + 1}. {player.username}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {isGameOver && player.returnedToLobby
                        ? "Returned to lobby"
                        : player.connected
                          ? "Connected"
                          : "Disconnected"}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold text-emerald-300">{player.score}</p>
                </article>
              ))}
            </div>
          </aside>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-sm text-zinc-500">
          <span>
            {isGameOver
              ? "Return to the lobby to change settings and ready up again."
              : "Next round starts automatically."}
          </span>
          <Link className="text-zinc-300 hover:text-zinc-50" href="/join">
            Leave room
          </Link>
        </footer>
      </div>
    </main>
  );
}
