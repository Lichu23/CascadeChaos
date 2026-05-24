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
      <section className="w-full max-w-xl rounded-md border border-zinc-800 bg-zinc-900 p-5">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-300">Multiplayer lobby</p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Create or join a room</h1>
          <p className="mt-3 leading-7 text-zinc-400">
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
            {pendingAction === "create" ? "Creating..." : "Create Room"}
          </Button>
        </div>

        <form className="mt-6 grid gap-4 border-t border-zinc-800 pt-6" onSubmit={joinRoom}>
          <Input
            autoCapitalize="characters"
            label="Room code"
            maxLength={8}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="ABCDE"
            value={roomCode}
          />
          <Button disabled={pendingAction !== null} type="submit" variant="secondary">
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
