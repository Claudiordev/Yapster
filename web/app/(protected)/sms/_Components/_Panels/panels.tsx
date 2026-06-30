import type { IconName } from "@/components/icon";

/** Feature views that open as a panel on top of the messages page. */
export type PanelKey = "game-servers" | "communities";

export const CHAT_PANELS: { key: PanelKey; label: string; icon: IconName }[] = [
  { key: "game-servers", label: "Game servers", icon: "game" },
  { key: "communities", label: "Find communities", icon: "search" },
];
