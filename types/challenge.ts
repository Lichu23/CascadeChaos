export type ChallengeDifficulty = "easy" | "medium" | "hard";

export type Challenge = {
  id: string;
  title: string;
  difficulty: ChallengeDifficulty;
  html: string;
  css: string;
  screenshot: string;
};
