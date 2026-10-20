"use client";

import { Button } from "@heroui/button";

import { Icon, type IconName } from "@/components/Icon/Icon";
import { useAccount } from "@/lib/hooks/useAccount";
import { useOpenPanel } from "../_Panels/OpenPanelContext";

const GAMES: { label: string; icon: IconName }[] = [
  { label: "CS2", icon: "counter-strike" },
  { label: "Valorant", icon: "valorant" },
  { label: "League of Legends", icon: "league-of-legends" },
  { label: "Rocket League", icon: "rocket-league" },
];

/** Top half of the start card: pitches the Events panel. */
export function EventsPromo() {
  const openPanel = useOpenPanel();
  const { isFeatureEnabled } = useAccount();
  const eventsEnabled = isFeatureEnabled("events");

  return (
    <div className="text-center">
      <Icon className="mx-auto text-brand" name="trophy" size={46} />
      <h2 className="mt-2 text-[29px] font-medium leading-tight tracking-tight text-foreground">
        <span className="font-bold text-foreground">Play.</span> Compete. Win.
      </h2>
      <p className="mt-2 text-[15px] leading-snug text-default-500">
        Join live tournaments and gaming sessions.
        <br />
        Compete for <span className="font-bold text-[#f5b73b]">cash prizes</span>.
      </p>

      <Button
        className="login-sign-in mt-5 w-full text-[15px]"
        endContent={<Icon name="arrow-right" size={16} />}
        isDisabled={!eventsEnabled}
        onPress={() => openPanel("events")}
      >
        {!eventsEnabled && (
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            Coming soon
          </span>
        )}
        Browse events
      </Button>

      <ul className="mt-5 flex justify-between gap-2 px-2">
        {GAMES.map((game) => (
          <li
            key={game.label}
            className="flex flex-col items-center gap-1.5 whitespace-nowrap text-xs text-default-500"
          >
            <Icon className="text-default-400" name={game.icon} size={34} />
            {game.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
