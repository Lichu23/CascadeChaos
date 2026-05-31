"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { challenges } from "@/lib/challenges";
import { getSocket } from "@/lib/socket/client";
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

  const leaveRoom = () => {
    getSocket().emit("room:leave");
  };

  if (!round) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 px-4 text-slate-900">
        <section className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
          <h1 className="text-xl font-black text-indigo-950">Reveal loading</h1>
          <p className="mt-2 text-slate-500">Waiting for the server to finish the round.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5">
        <header className="text-center">
          <Link
            className="block text-left text-sm font-bold text-indigo-700"
            href="/join"
            onClick={leaveRoom}
          >
            Back
          </Link>
          <div className="mt-4">
            <p className="inline-flex rounded-full bg-pink-500 px-4 py-1.5 text-xs font-black uppercase text-white">
              The big reveal
            </p>
            <h1 className="mt-4 text-3xl font-black text-indigo-950 sm:text-4xl">
              Who got closest?
            </h1>
            <p className="mt-2 text-slate-600">{challenge.title}</p>
          </div>
          <div className="mt-4 flex justify-center gap-3">
            <span className={`rounded-full px-4 py-2 text-sm font-black tabular-nums ${secondsLeft <= 3 ? "animate-pulse bg-pink-500 text-white" : "bg-white text-indigo-700"}`}>
              Voting in {secondsLeft}s
            </span>
            <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-indigo-700">
              Round {round.number}/{round.totalRounds}
            </span>
          </div>
        </header>

        <section className="rounded-3xl border-2 border-emerald-400 bg-white p-4 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
          <h2 className="text-sm font-black uppercase text-emerald-600">Real page</h2>
          <div className="relative mt-3 min-h-[420px] overflow-hidden rounded-2xl bg-indigo-50">
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

        <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-indigo-100 pt-4 text-sm font-semibold text-slate-500">
          <span>Voting starts automatically.</span>
          <Link
            className="text-indigo-700 hover:text-indigo-900"
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
