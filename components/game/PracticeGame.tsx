"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CodeViewer } from "@/components/game/CodeViewer";
import {
  DrawingCanvas,
  type DrawingCanvasHandle,
} from "@/components/game/DrawingCanvas";
import { Button } from "@/components/ui/Button";
import { useNavigationWarning } from "@/lib/navigation/use-navigation-warning";
import type { Challenge } from "@/types/challenge";

const ROUND_SECONDS = 90;

type PracticeGameProps = {
  challenges: Challenge[];
};

type Phase = "drawing" | "reveal";
type PracticeView = "code" | "draw";

export function PracticeGame({ challenges }: PracticeGameProps) {
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("drawing");
  const [activeView, setActiveView] = useState<PracticeView>("code");
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [drawingUrl, setDrawingUrl] = useState<string | null>(null);
  const drawingCanvasRef = useRef<DrawingCanvasHandle | null>(null);

  const challenge = challenges[challengeIndex];
  const isFinalChallenge = challengeIndex === challenges.length - 1;
  const progress = useMemo(
    () => Math.round((secondsLeft / ROUND_SECONDS) * 100),
    [secondsLeft],
  );

  useNavigationWarning({
    enabled: true,
    message: "Leave practice mode? Your current challenge and drawing will restart if you come back.",
  });

  useEffect(() => {
    if (phase !== "drawing") {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          drawingCanvasRef.current?.submit();
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [challengeIndex, phase]);

  const submitDrawing = (dataUrl: string) => {
    setDrawingUrl(dataUrl);
    setPhase("reveal");
  };

  const nextChallenge = () => {
    setChallengeIndex((current) => (current + 1) % challenges.length);
    setPhase("drawing");
    setActiveView("code");
    setSecondsLeft(ROUND_SECONDS);
    setDrawingUrl(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase text-indigo-700">
              Practice mode
            </p>
            <h1 className="mt-3 text-3xl font-black text-indigo-950 sm:text-4xl">
              {challenge.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`min-w-28 rounded-full px-4 py-3 text-right ${secondsLeft <= 10 ? "animate-pulse bg-pink-500 text-white" : "bg-white text-indigo-950"}`}>
              <p className="text-xs font-bold uppercase opacity-70">Time</p>
              <p className="text-2xl font-black tabular-nums">
                {secondsLeft}s
              </p>
            </div>
            <div className="min-w-36 rounded-full bg-white px-4 py-3 text-indigo-950">
              <p className="text-xs font-bold uppercase text-slate-500">Challenge</p>
              <p className="text-lg font-black">
                {challengeIndex + 1}/{challenges.length}
              </p>
            </div>
          </div>
        </header>

        <div className="h-2 overflow-hidden rounded-full bg-white/70">
          <div
            className="h-full bg-pink-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {phase === "drawing" ? (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex rounded-2xl bg-slate-100 p-1">
              <button
                className={`h-11 flex-1 rounded-xl text-sm font-bold transition ${
                  activeView === "code"
                    ? "bg-white text-indigo-700 shadow"
                    : "text-slate-500 hover:bg-white/60"
                }`}
                onClick={() => setActiveView("code")}
                type="button"
              >
                HTML / CSS Code
              </button>
              <button
                className={`h-11 flex-1 rounded-xl text-sm font-bold transition ${
                  activeView === "draw"
                    ? "bg-white text-indigo-700 shadow"
                    : "text-slate-500 hover:bg-white/60"
                }`}
                onClick={() => setActiveView("draw")}
                type="button"
              >
                Canvas
              </button>
            </div>

            <div className={activeView === "code" ? "block" : "hidden"}>
              <CodeViewer html={challenge.html} css={challenge.css} />
            </div>

            <div
              className={
                activeView === "draw"
                  ? "block"
                  : "pointer-events-none h-0 overflow-hidden opacity-0"
              }
            >
              <DrawingCanvas ref={drawingCanvasRef} onSubmit={submitDrawing} />
            </div>
          </div>
        ) : (
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-indigo-100 bg-white p-4 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-indigo-950">Your drawing</h2>
                <div className="flex gap-2">
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-indigo-50 px-4 text-sm font-bold text-indigo-800 transition hover:bg-indigo-100"
                    href="/"
                  >
                    Home
                  </Link>
                  <Button onClick={nextChallenge}>
                    {isFinalChallenge ? "Restart Practice" : "Next Challenge"}
                  </Button>
                </div>
              </div>
              <div className="grid min-h-[360px] place-items-center overflow-hidden rounded-2xl bg-amber-50">
                {drawingUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Submitted drawing" className="h-full w-full object-contain" src={drawingUrl} />
                ) : (
                  <p className="px-6 text-center text-sm text-zinc-500">
                    No drawing was submitted before the timer ended.
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-3xl border border-indigo-100 bg-white p-4 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
              <h2 className="mb-3 text-lg font-black text-indigo-950">Correct reveal</h2>
              <div className="relative min-h-[360px] overflow-hidden rounded-2xl bg-indigo-50">
                <Image
                  alt={`${challenge.title} reveal`}
                  className="object-contain"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  src={challenge.screenshot}
                />
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
