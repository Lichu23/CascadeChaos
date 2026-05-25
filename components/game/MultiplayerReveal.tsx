"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { challenges } from "@/lib/challenges";
import type { PublicRoom } from "@/types/room";

type MultiplayerRevealProps = {
  room: PublicRoom;
};

export function MultiplayerReveal({ room }: MultiplayerRevealProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const round = room.round;
  const challenge = useMemo(
    () => challenges.find((item) => item.id === round?.challengeId) ?? challenges[0],
    [round?.challengeId],
  );

  useEffect(() => {
    if (!round?.revealEndsAt) {
      return;
    }

    const revealEndsAt = round.revealEndsAt;
    const updateSeconds = () => {
      setSecondsLeft(Math.max(0, Math.ceil((revealEndsAt - Date.now()) / 1000)));
    };

    updateSeconds();
    const interval = window.setInterval(updateSeconds, 250);

    return () => window.clearInterval(interval);
  }, [round?.revealEndsAt]);

  if (!round) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 text-zinc-50">
        <section className="rounded-md border border-zinc-800 bg-zinc-900 p-5">
          <h1 className="text-xl font-semibold">Reveal loading</h1>
          <p className="mt-2 text-zinc-400">Waiting for the server to finish the round.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-300">
              Room {room.code} / Reveal
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              {challenge.title}
            </h1>
            <p className="mt-2 text-zinc-400">
              The real interface is shown before voting begins.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-28 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
              <p className="text-xs uppercase text-zinc-500">Voting in</p>
              <p className="text-2xl font-semibold tabular-nums text-zinc-50">
                {secondsLeft}s
              </p>
            </div>
            <div className="min-w-36 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Round</p>
              <p className="text-lg font-semibold text-zinc-50">
                {round.number}/{round.totalRounds}
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-xl font-semibold">Correct reveal</h2>
          <div className="relative mt-4 min-h-[560px] overflow-hidden rounded-md bg-zinc-950">
            <Image
              alt={`${challenge.title} reveal`}
              className="object-contain"
              fill
              priority
              sizes="(min-width: 1024px) 900px, 100vw"
              src={challenge.screenshot}
            />
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-sm text-zinc-500">
          <span>Voting starts automatically.</span>
          <Link className="text-zinc-300 hover:text-zinc-50" href="/join">
            Leave room
          </Link>
        </footer>
      </div>
    </main>
  );
}
