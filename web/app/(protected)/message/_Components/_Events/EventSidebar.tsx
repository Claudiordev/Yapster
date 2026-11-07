import { Button } from "@heroui/button";

import { Icon } from "@/components/Icon/Icon";
import type { GameEvent } from "@/types/event";
import { eventVoiceName } from "../../_Actions/useEventVoice";
import { CARD_CLASS } from "./EventOverview";
import { RoomCode } from "./RoomCode";
import { getEventDetails, getStarts } from "./utils/eventDetails";
import { formatPrize } from "./utils/eventFilters";

interface EventSidebarProps {
  event: GameEvent;
  onToggleJoin: () => void;
  onSupport: () => void;
  voice: { inVoice: boolean; join: () => void; leave: () => void };
}

/** Right column: prize pool, the join button and the event's key facts. */
export function EventSidebar({
  event,
  onToggleJoin,
  onSupport,
  voice,
}: EventSidebarProps) {
  const details = getEventDetails(event);
  const free = event.entryFee === 0;
  const live = event.status === "live";

  const rows: { label: string; value: string }[] = [
    { label: "Entry fee", value: free ? "Free" : formatPrize(event.entryFee) },
    { label: "Starts", value: live ? "Live now" : getStarts(event).label },
    { label: "Format", value: details.formatText },
    { label: "Players", value: `${event.players} / ${event.maxPlayers}` },
    { label: "Event code", value: event.eventCode },
  ];

  return (
    <aside className={`${CARD_CLASS} flex flex-col`}>
      <p className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-default-500">
        <Icon className="text-[#f5b73b]" name="trophy" size={14} />
        Cash prize pool
      </p>
      <p className="mt-3 text-center text-[40px] font-bold leading-none text-[#f5b73b]">
        {formatPrize(event.prizePool)}
      </p>

      {event.joined && event.roomCode ? (
        // Room-code events are left by leaving the in-game room, so there is no button.
        <div className="mt-6 flex h-11 items-center justify-center gap-2 rounded-medium border border-divider bg-black/20 text-sm font-semibold text-foreground">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
            <Icon name="check" size={12} />
          </span>
          You&apos;re in
        </div>
      ) : event.joined ? (
        <Button
          className="chat-profile-action chat-profile-settings mt-6 h-11 w-full text-sm font-semibold"
          variant="light"
          onPress={onToggleJoin}
        >
          Leave tournament
        </Button>
      ) : (
        <Button
          className="btn-coral mt-6 h-11 w-full text-sm font-bold"
          startContent={<Icon name="plus" size={16} />}
          onPress={onToggleJoin}
        >
          Join tournament
        </Button>
      )}
      {/* Joined players keep the room code and the event's voice group at hand. */}
      {event.joined && event.roomCode && (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-default-500">
              Room code
            </p>
            <RoomCode compact code={event.roomCode} />
          </div>
          {voice.inVoice && (
            <p className="flex items-center justify-center gap-2 text-center text-tiny text-default-500">
              <Icon
                className="flex-shrink-0 text-brand"
                name="headphones"
                size={14}
              />
              {eventVoiceName(event)} · {event.players} here
            </p>
          )}
          {voice.inVoice ? (
            <Button
              className="chat-profile-action chat-profile-logout !h-11 w-full text-sm font-semibold"
              variant="light"
              onPress={voice.leave}
            >
              Leave voice chat
            </Button>
          ) : (
            <Button
              className="chat-profile-action chat-profile-settings !h-11 w-full text-sm font-semibold"
              startContent={<Icon name="headphones" size={16} />}
              variant="light"
              onPress={voice.join}
            >
              Join voice chat
            </Button>
          )}
        </div>
      )}
      {!event.joined && (
        <p className="mt-3 text-center text-tiny text-default-400">
          {free ? "Free entry." : `${formatPrize(event.entryFee)} entry fee.`}{" "}
          No subscription needed.
        </p>
      )}

      <dl className="mt-5 flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border-t border-divider py-2.5 text-tiny"
          >
            <dt className="text-default-500">{row.label}</dt>
            <dd className="font-semibold text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>

      <Button
        className="chat-profile-action chat-profile-settings mt-4 !h-11 w-full text-sm font-semibold"
        startContent={<Icon name="gift" size={16} />}
        variant="light"
        onPress={onSupport}
      >
        Support the prize pool
      </Button>
    </aside>
  );
}
