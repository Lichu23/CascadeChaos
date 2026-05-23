import { PracticeGame } from "@/components/game/PracticeGame";
import { challenges } from "@/lib/challenges";

export default function PracticePage() {
  return <PracticeGame challenges={challenges} />;
}

