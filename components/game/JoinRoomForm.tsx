"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { getGuestId, getStoredUsername, storeUsername } from "@/lib/guest/guest-id";
import { getSocket } from "@/lib/socket/client";
import type { PublicRoom, RoomError } from "@/types/room";

export function JoinRoomForm() {
  const router = useRouter();
  const [guestId, setGuestId] = useState("");
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(null);
  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setGuestId(getGuestId());
      setUsername(getStoredUsername());
    });

    const socket = getSocket();

    const handleJoined = (room: PublicRoom) => {
      setPendingAction(null);
      router.push(`/room/${room.code}`);
    };

    const handleError = (error: RoomError) => {
      setPendingAction(null);
      setModal({ title: "Room error", message: error.message });
    };

    socket.on("room:joined", handleJoined);
    socket.on("room:error", handleError);

    return () => {
      socket.off("room:joined", handleJoined);
      socket.off("room:error", handleError);
    };
  }, [router]);

  const cleanUsername = username.trim();
  const cleanCode = roomCode.trim().toUpperCase();

  const validateUsername = () => {
    if (cleanUsername.length < 2) {
      setModal({ title: "Name required", message: "Choose a name with at least 2 characters." });
      return false;
    }

    storeUsername(cleanUsername);
    return true;
  };

  const createRoom = () => {
    if (!guestId || !validateUsername()) {
      return;
    }

    setPendingAction("create");
    getSocket().emit("room:create", { guestId, username: cleanUsername });
  };

  const joinRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!guestId || !validateUsername()) {
      return;
    }

    if (cleanCode.length < 4) {
      setModal({ title: "Room code required", message: "Enter the room code from the host." });
      return;
    }

    setPendingAction("join");
    getSocket().emit("room:join", {
      guestId,
      roomCode: cleanCode,
      username: cleanUsername,
    });
  };

  return (
    <>
      <section className="mx-auto w-full max-w-md">
        <button
          className="mb-6 text-sm font-bold text-indigo-700 transition hover:text-indigo-900"
          onClick={() => router.push("/")}
          type="button"
        >
          Back
        </button>
      </section>

      <section className="mx-auto w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-5 shadow-[0_25px_60px_rgba(79,70,229,0.15)]">
        <div>
          <h1 className="text-4xl font-black text-indigo-950">Create a room</h1>
          <p className="mt-2 leading-7 text-slate-600">
            Rooms need at least 3 players before the host can start.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <Input
            autoComplete="nickname"
            label="Display name"
            maxLength={24}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Your name"
            value={username}
          />

          <Button disabled={pendingAction !== null} onClick={createRoom}>
            {pendingAction === "create" ? "Creating..." : "Create & enter lobby"}
          </Button>
        </div>

        <form className="mt-6 grid gap-4 border-t border-indigo-100 pt-6" onSubmit={joinRoom}>
          <Input
            autoCapitalize="characters"
            label="Room code"
            maxLength={8}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="ABCDE"
            value={roomCode}
          />
          <Button disabled={pendingAction !== null || cleanCode.length < 4} type="submit" variant="secondary">
            {pendingAction === "join" ? "Joining..." : "Join Room"}
          </Button>
        </form>
      </section>

      {modal ? (
        <Modal
          message={modal.message}
          onClose={() => setModal(null)}
          title={modal.title}
        />
      ) : null}
    </>
  );
}
