import fs from "node:fs";
import path from "node:path";

const sourceDir = "html-css-game";

const challengeFiles = [
  ["crypto", "Crypto Card", "crypto.html", "cryptoStyle.css", "crypto.png"],
  ["dashboard", "Dashboard Card", "dashboard.html", "dashboardStyle.css", "dashboard.png"],
  ["fitness-card", "Fitness Card", "fitnessCard.html", "fitnessStyle.css", "fitnessCard.png"],
  ["media-view", "Media View", "mediaView.html", "mediaView.css", "mediaView.png"],
  ["music-card", "Music Card", "musicCard.html", "musicStyle.css", "music.png"],
  ["productivity-card", "Productivity Card", "productivityCard.html", "productivityStyle.css", "productivity.png"],
  ["profile-card", "Profile Card", "profileCard.html", "profileStyle.css", "profileCard.png"],
  ["sales-view", "Sales View", "salesView.html", "salesView.css", "salesView.png"],
  ["shop-card", "Shop Card", "shopCard.html", "shopStyle.css", "shopCard.png"],
  ["travel-card", "Travel Card", "travelCard.html", "travelStyle.css", "travelCard.png"],
  ["weather-card", "Weather Card", "weatherCard.html", "weatherStyle.css", "weatherCard.png"],
];

fs.mkdirSync("types", { recursive: true });
fs.mkdirSync(path.join("lib", "challenges"), { recursive: true });

const challengeEntries = challengeFiles.map(
  ([id, title, htmlFile, cssFile, imageFile]) => {
    const html = fs.readFileSync(path.join(sourceDir, htmlFile), "utf8");
    const css = fs.readFileSync(path.join(sourceDir, cssFile), "utf8");

    return `  {
    id: ${JSON.stringify(id)},
    title: ${JSON.stringify(title)},
    difficulty: "easy",
    html: ${JSON.stringify(html)},
    css: ${JSON.stringify(css)},
    screenshot: ${JSON.stringify(`/challenges/${imageFile}`)},
  }`;
  },
);

fs.writeFileSync(
  path.join("types", "challenge.ts"),
  `export type ChallengeDifficulty = "easy" | "medium" | "hard";

export type Challenge = {
  id: string;
  title: string;
  difficulty: ChallengeDifficulty;
  html: string;
  css: string;
  screenshot: string;
};
`,
);

fs.writeFileSync(
  path.join("lib", "challenges", "data.ts"),
  `import type { Challenge } from "@/types/challenge";

export const challenges = [
${challengeEntries.join(",\n")}
] satisfies Challenge[];
`,
);

fs.writeFileSync(
  path.join("lib", "challenges", "index.ts"),
  `export { challenges } from "./data";
export type { Challenge, ChallengeDifficulty } from "@/types/challenge";
`,
);

