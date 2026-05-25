"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CodeViewer } from "@/components/game/CodeViewer";
import {
  DrawingCanvas,
  type DrawingCanvasHandle,
} from "@/components/game/DrawingCanvas";
import { challenges } from "@/lib/challenges";
import { getSocket } from "@/lib/socket/client";
import type { PublicRoom } from "@/types/room";

type MultiplayerDrawingRoundProps = {
  guestId: string;
  room: PublicRoom;
};

type RoundView = "code" | "draw";

export function MultiplayerDrawingRound({ guestId, room }: MultiplayerDrawingRoundProps) {
  const [activeView, setActiveView] = useState<RoundView>("code");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [localSubmitted, setLocalSubmitted] = useState(false);
  const drawingCanvasRef = useRef<DrawingCanvasHandle | null>(null);
  const autoSubmittedRoundRef = useRef<number | null>(null);

  const round = room.round;
  const challenge = useMemo(
    () => challenges.find((item) => item.id === round?.challengeId) ?? challenges[0],
    [round?.challengeId],
  );
  const hasServerSubmission = Boolean(round?.submittedGuestIds.includes(guestId));
  const submitted = localSubmitted || hasServerSubmission;
  const isSubmissionOpen = Boolean(round?.isSubmissionOpen);
  const disabled = submitted || !isSubmissionOpen;
  const roundDuration = Math.max(1, Math.round(((round?.endsAt ?? 0) - (round?.startedAt ?? 0)) / 1000));
  const progress = Math.max(0, Math.min(100, Math.round((secondsLeft / roundDuration) * 100)));

  useEffect(() => {
    if (!round) {
      return;
    }

    const updateSeconds = () => {
      setSecondsLeft(Math.max(0, Math.ceil((round.endsAt - Date.now()) / 1000)));
    };

    updateSeconds();
    const interval = window.setInterval(updateSeconds, 250);

    return () => window.clearInterval(interval);
  }, [round]);

  useEffect(() => {
    if (!round || submitted || !isSubmissionOpen || secondsLeft > 1) {
      return;
    }

    if (autoSubmittedRoundRef.current === round.number) {
      return;
    }

    autoSubmittedRoundRef.current = round.number;
    drawingCanvasRef.current?.submit();
  }, [isSubmissionOpen, round, secondsLeft, submitted]);

  useEffect(() => {
    if (!round || submitted || !isSubmissionOpen) {
      return;
    }

    const delayMs = Math.max(0, round.endsAt - Date.now() - 3_000);
    const timeout = window.setTimeout(() => {
      if (autoSubmittedRoundRef.current === round.number) {
        return;
      }

      autoSubmittedRoundRef.current = round.number;
      drawingCanvasRef.current?.submit();
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [isSubmissionOpen, round, submitted]);

  const submitDrawing = (dataUrl: string) => {
    if (!round || submitted || !isSubmissionOpen) {
      return;
    }

    setLocalSubmitted(true);
    getSocket().emit("drawing:submit", {
      roomCode: room.code,
      guestId,
      dataUrl,
    });
  };

  const saveDraft = (dataUrl: string) => {
    if (!round || submitted || !isSubmissionOpen) {
      return;
    }

    getSocket().emit("drawing:draft", {
      roomCode: room.code,
      guestId,
      dataUrl,
    });
  };

  if (!round) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-4 text-zinc-50">
        <section className="rounded-md border border-zinc-800 bg-zinc-900 p-5">
          <h1 className="text-xl font-semibold">Round loading</h1>
          <p className="mt-2 text-zinc-400">Waiting for the server to send the challenge.</p>
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
              Room {room.code} / Drawing round
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-50 sm:text-4xl">
              {challenge.title}
            </h1>
            <p className="mt-2 text-zinc-400">
              {submitted ? "Drawing submitted. Waiting for everyone else." : "Read the code, then draw your prediction."}
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
              <p className="text-xs uppercase text-zinc-500">Round</p>
              <p className="text-lg font-semibold text-zinc-50">
                {round.number}/{round.totalRounds}
              </p>
            </div>
            <div className="min-w-36 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-xs uppercase text-zinc-500">Submitted</p>
              <p className="text-lg font-semibold text-zinc-50">
                {round.submissionCount}/{round.expectedSubmissions}
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

        {!isSubmissionOpen ? (
          <section className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100">
            Drawing time is closed. Reveal is the next phase to implement.
          </section>
        ) : null}

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
            <DrawingCanvas
              disabled={disabled}
              onDraftChange={saveDraft}
              onSubmit={submitDrawing}
              ref={drawingCanvasRef}
            />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-sm text-zinc-500">
          <span>Players stay synced through the server timer.</span>
          <Link className="text-zinc-300 hover:text-zinc-50" href="/join">
            Leave room
          </Link>
        </footer>
      </div>
    </main>
  );
}
