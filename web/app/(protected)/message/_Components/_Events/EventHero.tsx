import { Icon } from "@/components/Icon/Icon";
import type { GameEvent } from "@/types/event";
import { HostLogo } from "./HostLogo";
import { EVENT_GAME_BY_ID } from "./utils/eventGames";

const STATUS_BADGE: Record<
  GameEvent["status"],
  { label: string; className: string }
> = {
  upcoming: {
    label: "Upcoming",
    className: "border-primary/40 bg-primary/15 text-primary",
  },
  live: {
    label: "Live now",
    className: "border-brand/40 bg-brand/15 text-brand",
  },
  finished: {
    label: "Finished",
    className: "border-divider bg-default-100 text-default-500",
  },
};

/** Banner at the top of the detail page: status, title, host and game art. */
export function EventHero({ event }: { event: GameEvent }) {
  const game = EVENT_GAME_BY_ID[event.game];
  const badge = STATUS_BADGE[event.status];

  return (
    <section
      className={`relative overflow-hidden rounded-large border-2 border-surface-border bg-gradient-to-br shadow-[0_4px_0_#1e1f22] ${game.gradient}`}
    >
      {/* Game wordmark, large and faint, on the right. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className="pointer-events-none absolute -right-4 top-1/2 hidden h-36 w-auto max-w-[45%] -translate-y-1/2 object-contain object-right opacity-15 brightness-0 invert sm:block"
        src={game.logo}
      />

      <div className="relative flex flex-col gap-3 px-8 py-10">
        {game.heroBadges && (
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-small border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
            >
              {badge.label}
            </span>
            <span className="rounded-small border border-divider bg-black/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-default-600">
              Community tournament
            </span>
          </div>
        )}

        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-white">
          {event.name}
        </h1>

        <p className="flex flex-wrap items-center gap-2 text-sm text-default-500">
          <HostLogo size={24} />
          Hosted by
          <strong className="text-foreground">{event.hostedBy}</strong>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-white">
            <Icon name="check" size={10} />
          </span>
          · {game.label}
        </p>
      </div>
    </section>
  );
}
