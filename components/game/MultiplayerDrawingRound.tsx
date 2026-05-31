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

  const leaveRoom = () => {
    getSocket().emit("room:leave");
  };

  if (!round) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 px-4 text-slate-900">
        <section className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
          <h1 className="text-xl font-black text-indigo-950">Round loading</h1>
          <p className="mt-2 text-slate-500">Waiting for the server to send the challenge.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-100 via-indigo-50 to-pink-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase text-indigo-700">
              Room {room.code} / Drawing round
            </p>
            <h1 className="mt-3 text-3xl font-black text-indigo-950 sm:text-4xl">
              {challenge.title}
            </h1>
            <p className="mt-2 text-slate-600">
              {submitted ? "Drawing submitted. Waiting for everyone else." : "Read the code, then draw your prediction."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`min-w-28 rounded-full px-4 py-3 text-right ${secondsLeft <= 10 ? "animate-pulse bg-pink-500 text-white" : "bg-white text-indigo-950"}`}>
              <p className="text-xs font-bold uppercase opacity-70">Time</p>
              <p className="text-2xl font-black tabular-nums">
                {secondsLeft}s
              </p>
            </div>
            <div className="min-w-36 rounded-full bg-white px-4 py-3 text-indigo-950">
              <p className="text-xs font-bold uppercase text-slate-500">Round</p>
              <p className="text-lg font-black">
                {round.number}/{round.totalRounds}
              </p>
            </div>
            <div className="min-w-36 rounded-full bg-white px-4 py-3 text-indigo-950">
              <p className="text-xs font-bold uppercase text-slate-500">Submitted</p>
              <p className="text-lg font-black">
                {round.submissionCount}/{round.expectedSubmissions}
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

        {!isSubmissionOpen ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-100 px-4 py-3 font-bold text-amber-800">
            Drawing time is closed. Reveal starts next.
          </section>
        ) : null}

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
            <DrawingCanvas
              disabled={disabled}
              onDraftChange={saveDraft}
              onSubmit={submitDrawing}
              ref={drawingCanvasRef}
            />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-indigo-100 pt-4 text-sm text-slate-500">
          <span>Players stay synced through the server timer.</span>
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
