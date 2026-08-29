import type { IconName } from "@/components/icon";

/** Feature views that open as a panel on top of the messages page. */
export type PanelKey = "game-servers";

export const CHAT_PANELS: {
  key: PanelKey;
  label: string;
  icon: IconName;
  /** Shown in the nav but not selectable yet — appends " - Coming Soon". */
  comingSoon?: boolean;
}[] = [
  { key: "game-servers", label: "Game servers", icon: "game", comingSoon: true },
];
