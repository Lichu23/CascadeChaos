"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { getSocket } from "@/lib/socket/client";
import type { PublicRoom } from "@/types/room";

type MultiplayerVotingProps = {
  guestId: string;
  room: PublicRoom;
};

export function MultiplayerVoting({ guestId, room }: MultiplayerVotingProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [localVoteTarget, setLocalVoteTarget] = useState<string | null>(null);
  const round = room.round;
  const voting = round?.voting;
  const hasVoted = Boolean(voting?.votedGuestIds.includes(guestId) || localVoteTarget);
  const eligibleSubmissions = useMemo(
    () => round?.submissions.filter((submission) => submission.guestId !== guestId) ?? [],
    [guestId, round?.submissions],
  );

  useEffect(() => {
    if (!voting) {
      return;
    }

    const updateSeconds = () => {
      setSecondsLeft(Math.max(0, Math.ceil((voting.endsAt - Date.now()) / 1000)));
    };

    updateSeconds();
    const interval = window.setInterval(updateSeconds, 250);

    return () => window.clearInterval(interval);
  }, [voting]);

  const castVote = (targetGuestId: string) => {
    if (!round || !voting?.isVotingOpen || hasVoted) {
      return;
    }

    setLocalVoteTarget(targetGuestId);
    getSocket().emit("vote:cast", {
      guestId,
      roomCode: room.code,
      targetGuestId,
    });
  };

  if (!round || !voting) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 text-zinc-50">
        <section className="rounded-md border border-zinc-800 bg-zinc-900 p-5">
          <h1 className="text-xl font-semibold">Voting loading</h1>
          <p className="mt-2 text-zinc-400">Waiting for the server to open voting.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-300">
              Room {room.code} / Voting
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              Vote for the closest drawing
            </h1>
            <p className="mt-2 text-zinc-400">
              {hasVoted ? "Vote submitted. Waiting for everyone else." : "Pick one drawing. You cannot vote for yourself."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-28 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
              <p className="text-xs uppercase text-zinc-500">Time</p>
              <p className="text-2xl font-semibold tabular-nums text-zinc-50">
                {secondsLeft}s
              </p>
            </div>
            <div className="min-w-36 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Votes</p>
              <p className="text-lg font-semibold text-zinc-50">
                {voting.voteCount}/{voting.expectedVotes}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {eligibleSubmissions.length === 0 ? (
            <div className="rounded-md border border-zinc-800 bg-zinc-900 p-5 text-zinc-400 md:col-span-2 xl:col-span-3">
              No submitted drawings are available to vote on.
            </div>
          ) : null}
          {eligibleSubmissions.map((submission) => {
            const selected = localVoteTarget === submission.guestId;

            return (
              <article
                className={`rounded-md border bg-zinc-900 p-4 ${
                  selected ? "border-emerald-400" : "border-zinc-800"
                }`}
                key={submission.guestId}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{submission.username}</h2>
                  <Button
                    disabled={hasVoted || !voting.isVotingOpen}
                    onClick={() => castVote(submission.guestId)}
                  >
                    {selected ? "Voted" : "Vote"}
                  </Button>
                </div>
                <div className="grid min-h-[300px] place-items-center overflow-hidden rounded-md bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`${submission.username} drawing`}
                    className="h-full w-full object-contain"
                    src={submission.dataUrl}
                  />
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
