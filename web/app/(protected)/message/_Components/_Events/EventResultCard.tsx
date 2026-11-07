import { Avatar } from "@heroui/avatar";

import type { GameEvent } from "@/types/event";
import { CARD_CLASS } from "./EventOverview";
import { formatPrize } from "./utils/eventFilters";

/** Standings tab of a finished Among Us event: the winning side and each survivor's share. */
export function EventResultCard({ event }: { event: GameEvent }) {
  const result = event.result;

  if (!result) {
    return (
      <section className={CARD_CLASS}>
        <p className="py-6 text-center text-sm text-default-400">
          The result will show up here soon.
        </p>
      </section>
    );
  }

  const share = Math.round(event.prizePool / result.survivors.length);

  return (
    <section className={CARD_CLASS}>
      <h2 className="text-lg font-bold text-foreground">Final result</h2>
      <p className="mt-2 text-sm text-default-500">
        The {result.winningSide} won. Everyone still alive at the end gets an
        equal share of the {formatPrize(event.prizePool)} prize pool.
      </p>

      <ul className="mt-5 flex flex-col gap-2">
        {result.survivors.map((name) => (
          <li
            key={name}
            className="flex items-center gap-3 rounded-medium border border-divider bg-black/20 px-4 py-3"
          >
            <Avatar
              className="bg-default-200 text-brand ring-1 ring-default-300"
              name={name.charAt(0).toUpperCase()}
              size="sm"
            />
            <span className="flex-grow text-sm font-semibold text-foreground">
              {name}
            </span>
            <span className="text-tiny text-default-500">Alive</span>
            <span className="text-sm font-bold text-[#f5b73b]">
              {formatPrize(share)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
