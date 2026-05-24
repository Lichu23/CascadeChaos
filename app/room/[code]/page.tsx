import { RoomLobby } from "@/components/game/RoomLobby";

type RoomPageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  return <RoomLobby roomCode={code.toUpperCase()} />;
}

