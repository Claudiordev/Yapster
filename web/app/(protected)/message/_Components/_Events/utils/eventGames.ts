import type { IconName } from "@/components/Icon/Icon";
import type { EventGame } from "@/types/event";

export interface EventGameInfo {
  id: EventGame;
  label: string;
  icon: IconName;
  /** Card backdrop (Tailwind gradient classes). */
  gradient: string;
  /** Official wordmark in /public/images/games (black; shown white). */
  logo: string;
  /** Tailwind height of the wordmark on the game card. */
  logoClass: string;
  /** Game mode shown on the detail page, e.g. "Battle Royale". */
  modeLabel: string;
  /** Text of the "Skill level" tile. */
  skillText: string;
  /** What rounds are called, plural and singular ("matches" / "match"). */
  roundNoun: string;
  roundNounOne: string;
  /** Who competes: squads or single players. */
  competitor: "squads" | "players";
  /** Show the status and "Community tournament" badges in the detail banner. */
  heroBadges: boolean;
  /** Glyph colour on the card and in the row's game tile. */
  accent: string;
}

/** The only games with events for now. */
export const EVENT_GAMES: EventGameInfo[] = [
  {
    id: "apex-legends",
    label: "Apex Legends",
    icon: "apex-legends",
    logo: "/images/games/apex-legends.svg",
    logoClass: "h-12",
    modeLabel: "Battle Royale",
    skillText: "All levels welcome",
    roundNoun: "matches",
    roundNounOne: "match",
    competitor: "squads",
    heroBadges: true,
    gradient: "from-[#5b1620] via-[#2b2d31] to-[#2b2d31]",
    accent: "text-[#ff5a5f]",
  },
  {
    id: "among-us",
    label: "Among Us",
    icon: "among-us",
    logo: "/images/games/among-us.svg",
    logoClass: "h-9",
    modeLabel: "Classic",
    skillText: "All ranks welcomed",
    roundNoun: "rounds",
    roundNounOne: "round",
    competitor: "players",
    heroBadges: false,
    gradient: "from-[#1c3d52] via-[#2b2d31] to-[#2b2d31]",
    accent: "text-[#6ec1e4]",
  },
];

export const EVENT_GAME_BY_ID = Object.fromEntries(
  EVENT_GAMES.map((game) => [game.id, game]),
) as Record<EventGame, EventGameInfo>;
