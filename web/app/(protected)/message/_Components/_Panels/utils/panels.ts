import type { IconName } from "@/components/Icon/Icon";

/** Feature views that open as a panel on top of the messages page. */
export type PanelKey = "game-servers" | "events" | "premium";

/** Each panel's key doubles as its feature-flag name; a switched-off panel shows disabled in the nav. */
export const CHAT_PANELS: {
  key: PanelKey;
  label: string;
  icon: IconName;
}[] = [
  { key: "game-servers", label: "Game servers", icon: "game" },
  { key: "events", label: "Events", icon: "trophy" },
  { key: "premium", label: "Premium", icon: "star" },
];
