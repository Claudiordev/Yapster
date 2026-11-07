import { Icon } from "@/components/Icon/Icon";
import type { EventGameInfo } from "./utils/eventGames";

interface GameCardProps {
  game: EventGameInfo;
  openEvents: number;
  liveEvents: number;
  selected: boolean;
  /** Another game is selected, so this one is dimmed. */
  dimmed: boolean;
  onPress: () => void;
}

/** A "Choose your game" card. It works as a toggle filter: press to show only this game, press again to clear. */
export function GameCard({
  game,
  openEvents,
  liveEvents,
  selected,
  dimmed,
  onPress,
}: GameCardProps) {
  return (
    <button
      aria-label={game.label}
      aria-pressed={selected}
      className={`relative flex h-36 flex-col justify-end overflow-hidden rounded-large border-2 bg-gradient-to-br p-4 text-left shadow-[0_4px_0_#1e1f22] transition-[border-color,transform,opacity] hover:-translate-y-0.5 active:translate-y-0.5 ${game.gradient} ${
        selected ? "border-brand" : "border-surface-border hover:border-default-400"
      } ${dimmed ? "opacity-55 hover:opacity-100" : ""}`}
      type="button"
      onClick={onPress}
    >
      {liveEvents > 0 && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-small border border-brand/40 bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          {liveEvents} live now
        </span>
      )}

      {/* Select / unselect marker. */}
      <span
        aria-hidden
        className={`absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full border-2 text-white transition-colors ${
          selected ? "border-brand bg-brand" : "border-white/30 bg-black/30"
        }`}
      >
        {selected && <Icon name="check" size={14} />}
      </span>

      {/* The wordmarks are black SVGs; brightness-0 + invert renders them white. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className={`w-auto max-w-[70%] self-start object-contain brightness-0 invert ${game.logoClass}`}
        src={game.logo}
      />
      <span className="mt-2 text-tiny text-white/70">
        {openEvents} event{openEvents === 1 ? "" : "s"} to explore
      </span>
    </button>
  );
}
