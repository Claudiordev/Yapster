"use client";

import { useState } from "react";
import { addToast } from "@heroui/toast";
import { Button } from "@heroui/button";

import { Icon } from "@/components/Icon/Icon";
import type { GameEvent } from "@/types/event";
import { useEventVoice } from "../../_Actions/useEventVoice";
import { CARD_CLASS, EventOverview } from "./EventOverview";
import { EventHero } from "./EventHero";
import { EventResultCard } from "./EventResultCard";
import { AmongUsRules } from "./EventRules";
import { EventSidebar } from "./EventSidebar";
import { RoomCodeModal } from "./RoomCodeModal";
import { SupportPrizeModal } from "./SupportPrizeModal";
import { EVENT_GAME_BY_ID } from "./utils/eventGames";
import { formatPrize } from "./utils/eventFilters";

const TABS = ["Overview", "Squads", "Standings", "Rules"] as const;

interface EventDetailPageProps {
  event: GameEvent;
  onBack: () => void;
  onClose: () => void;
  onToggleJoin: (id: string) => void;
  onContribute: (id: string, amount: number) => void;
}

/** One event: hero, tabs (only Overview has content so far) and the join sidebar. */
export default function EventDetailPage({
  event,
  onBack,
  onClose,
  onToggleJoin,
  onContribute,
}: EventDetailPageProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [supportOpen, setSupportOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const voice = useEventVoice();
  const game = EVENT_GAME_BY_ID[event.game];
  // Among Us has no squads, and its standings only exist once the event is finished.
  const tabs = TABS.filter((name) => {
    if (name === "Squads") return game.competitor === "squads";
    if (name === "Standings") return game.competitor === "squads" || event.status === "finished";

    return true;
  });

  return (
    <div className="relative h-full overflow-y-auto bg-content1 text-foreground dark:bg-surface-sidebar">
      <Button
        isIconOnly
        aria-label="Close"
        className="chat-profile-action chat-profile-settings absolute right-5 top-4 z-10"
        variant="light"
        onPress={onClose}
      >
        <Icon name="close" size={16} />
      </Button>

      <div className="mx-auto max-w-[1100px] px-6 pb-16 pt-6">
        <button
          className="mb-4 flex items-center gap-2 text-sm text-default-500 transition-colors hover:text-foreground"
          type="button"
          onClick={onBack}
        >
          <Icon className="rotate-180" name="arrow-right" size={16} />
          {game.label} events
        </button>

        <EventHero event={event} />

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <div className="mb-5 flex gap-6 border-b border-divider">
              {tabs.map((name) => {
                const active = tab === name;

                return (
                  <button
                    key={name}
                    aria-pressed={active}
                    className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-brand text-foreground"
                        : "border-transparent text-default-500 hover:text-foreground"
                    }`}
                    type="button"
                    onClick={() => setTab(name)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {tab === "Overview" ? (
              <EventOverview event={event} />
            ) : tab === "Standings" && game.competitor === "players" ? (
              <EventResultCard event={event} />
            ) : tab === "Rules" && game.competitor === "players" ? (
              <AmongUsRules />
            ) : (
              <section className={CARD_CLASS}>
                <p className="py-6 text-center text-sm text-default-400">
                  {tab} will show up here soon.
                </p>
              </section>
            )}
          </div>

          <EventSidebar
            event={event}
            voice={voice}
            onSupport={() => setSupportOpen(true)}
            // Events with a room code are joined through the code; the player is only
            // registered once they are verified in the room.
            onToggleJoin={() =>
              event.roomCode && !event.joined ? setRoomOpen(true) : onToggleJoin(event.id)
            }
          />
        </div>
      </div>

      {event.roomCode && (
        <RoomCodeModal
          eventName={event.name}
          isOpen={roomOpen}
          roomCode={event.roomCode}
          onClose={() => setRoomOpen(false)}
          onVerified={() => onToggleJoin(event.id)}
        />
      )}

      <SupportPrizeModal
        eventName={event.name}
        isOpen={supportOpen}
        prizePool={event.prizePool}
        onClose={() => setSupportOpen(false)}
        onContribute={(amount) => {
          onContribute(event.id, amount);
          addToast({ title: `Added ${formatPrize(amount)} to the prize pool (demo)` });
        }}
      />
    </div>
  );
}
