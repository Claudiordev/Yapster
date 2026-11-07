import type { EventGame } from "@/types/event";
import { EVENT_GAME_BY_ID } from "./utils/eventGames";

/** Game badge at the start of an event row: the same logo and backdrop as the game card on top. */
export function GameTile({ game }: { game: EventGame }) {
  const info = EVENT_GAME_BY_ID[game];

  return (
    <span
      className={`grid h-12 w-20 flex-shrink-0 place-items-center rounded-medium border-2 border-divider bg-gradient-to-br px-2 ${info.gradient}`}
      title={info.label}
    >
      {/* The wordmarks are black SVGs; brightness-0 + invert renders them white. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={info.label}
        className="max-h-7 w-auto max-w-full object-contain brightness-0 invert"
        src={info.logo}
      />
    </span>
  );
}
