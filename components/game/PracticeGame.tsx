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
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-300">
              Practice mode
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              {challenge.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-28 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
              <p className="text-xs uppercase text-zinc-500">Time</p>
              <p className="text-2xl font-semibold tabular-nums text-zinc-50">
                {secondsLeft}s
              </p>
            </div>
            <div className="min-w-36 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Challenge</p>
              <p className="text-lg font-semibold text-zinc-50">
                {challengeIndex + 1}/{challenges.length}
              </p>
            </div>
          </div>
        </header>

        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {phase === "drawing" ? (
          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex rounded-md border border-zinc-800 bg-zinc-900 p-1">
              <button
                className={`h-11 flex-1 rounded text-sm font-semibold transition ${
                  activeView === "code"
                    ? "bg-zinc-100 text-zinc-950"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
                onClick={() => setActiveView("code")}
                type="button"
              >
                HTML / CSS Code
              </button>
              <button
                className={`h-11 flex-1 rounded text-sm font-semibold transition ${
                  activeView === "draw"
                    ? "bg-emerald-400 text-zinc-950"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
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
            <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Your drawing</h2>
                <div className="flex gap-2">
                  <Link
                    className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-800 px-4 text-sm font-semibold text-zinc-50 transition hover:bg-zinc-700"
                    href="/"
                  >
                    Home
                  </Link>
                  <Button onClick={nextChallenge}>
                    {isFinalChallenge ? "Restart Practice" : "Next Challenge"}
                  </Button>
                </div>
              </div>
              <div className="grid min-h-[360px] place-items-center overflow-hidden rounded bg-white">
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
            <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4">
              <h2 className="mb-3 text-lg font-semibold">Correct reveal</h2>
              <div className="relative min-h-[360px] overflow-hidden rounded bg-zinc-950">
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
