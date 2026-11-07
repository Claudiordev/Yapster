import { Button } from "@heroui/button";

import type { GameEvent } from "@/types/event";
import { GameTile } from "./GameTile";
import { HostLogo } from "./HostLogo";
import { getStarts, roundsText } from "./utils/eventDetails";
import { formatPrize, getRowAction } from "./utils/eventFilters";

/** Column layout shared by the header and every row. */
export const EVENT_GRID =
  "grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_7.5rem] items-center gap-4";

interface EventRowProps {
  event: GameEvent;
  onOpen: (id: string) => void;
}

export function EventRow({ event, onOpen }: EventRowProps) {
  const action = getRowAction(event);
  const starts = getStarts(event);
  const fill = Math.min(100, (event.players / event.maxPlayers) * 100);

  return (
    <article
      className={`${EVENT_GRID} rounded-large border-2 border-surface-border bg-content1 px-4 py-3 shadow-[0_4px_0_#1e1f22] dark:bg-surface-chat`}
    >
      {/* Event */}
      <div className="flex min-w-0 items-center gap-3">
        <GameTile game={event.game} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{event.name}</p>
          <p className="text-[11px] leading-snug text-default-500">
            {event.format} · {roundsText(event)}
          </p>
        </div>
      </div>

      {/* Hosted by */}
      <div className="flex min-w-0 items-center gap-2">
        <HostLogo size={22} />
        <p className="truncate text-sm font-medium text-foreground">{event.hostedBy}</p>
      </div>

      {/* Starts */}
      <div className="min-w-0">
        {event.status === "live" ? (
          <span className="inline-flex items-center gap-1.5 rounded-small border border-brand/40 bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Live now
          </span>
        ) : (
          <p className="truncate text-sm font-semibold text-foreground">
            {starts.label}
          </p>
        )}
        <p className="mt-1 truncate text-tiny text-default-500">{starts.detail}</p>
      </div>

      {/* Players */}
      <div>
        <p className="text-sm font-semibold text-foreground">
          {event.players}
          <span className="font-normal text-default-500"> / {event.maxPlayers}</span>
        </p>
        <div className="mt-1.5 h-1 w-full max-w-[6.5rem] overflow-hidden rounded-full bg-default-200">
          <div className="h-full rounded-full bg-[#f5b73b]" style={{ width: `${fill}%` }} />
        </div>
      </div>

      {/* Prize pool */}
      <div>
        <p className="text-lg font-bold text-[#f5b73b]">{formatPrize(event.prizePool)}</p>
        <p className="text-[10px] text-default-500">cash prize pool</p>
      </div>

      {/* Action */}
      {action.tone === "brand" ? (
        <Button
          className="btn-coral h-9 w-full text-sm font-bold"
          onPress={() => onOpen(event.id)}
        >
          {action.label}
        </Button>
      ) : (
        <Button
          className="chat-profile-action chat-profile-settings w-full text-sm font-semibold"
          isDisabled={action.disabled}
          variant="light"
          onPress={() => action.opensDetail && onOpen(event.id)}
        >
          {action.label}
        </Button>
      )}
    </article>
  );
}
