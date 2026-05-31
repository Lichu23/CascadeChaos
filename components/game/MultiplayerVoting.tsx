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
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 px-4 text-slate-900">
        <section className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
          <h1 className="text-xl font-black text-indigo-950">Voting loading</h1>
          <p className="mt-2 text-slate-500">Waiting for the server to open voting.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5">
        <header className="text-center">
          <div>
            <p className="inline-flex rounded-full bg-pink-500 px-4 py-1.5 text-xs font-black uppercase text-white">
              Room {room.code} / Voting
            </p>
            <h1 className="mt-4 text-3xl font-black text-indigo-950 sm:text-4xl">
              Vote for the closest drawing
            </h1>
            <p className="mt-2 text-slate-600">
              {hasVoted ? "Vote submitted. Waiting for everyone else." : "Pick one drawing. You cannot vote for yourself."}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <span className={`rounded-full px-4 py-2 text-sm font-black tabular-nums ${secondsLeft <= 10 ? "animate-pulse bg-pink-500 text-white" : "bg-white text-indigo-700"}`}>
              {secondsLeft}s
            </span>
            <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-indigo-700">
              Votes {voting.voteCount}/{voting.expectedVotes}
            </span>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {eligibleSubmissions.length === 0 ? (
            <div className="rounded-3xl border border-indigo-100 bg-white p-5 text-slate-500 sm:col-span-2">
              No submitted drawings are available to vote on.
            </div>
          ) : null}
          {eligibleSubmissions.map((submission) => {
            const selected = localVoteTarget === submission.guestId;

            return (
              <article
                className={`rounded-3xl border bg-white p-4 shadow-[0_25px_60px_rgba(79,70,229,0.15)] ${
                  selected ? "border-pink-500 ring-2 ring-pink-500" : "border-indigo-100"
                }`}
                key={submission.guestId}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black text-indigo-950">{submission.username}</h2>
                  <Button
                    className="min-h-9 rounded-xl px-3 text-xs"
                    disabled={hasVoted || !voting.isVotingOpen}
                    onClick={() => castVote(submission.guestId)}
                  >
                    {selected ? "Voted" : "Vote"}
                  </Button>
                </div>
                <div className="grid min-h-[260px] place-items-center overflow-hidden rounded-2xl bg-amber-50">
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
