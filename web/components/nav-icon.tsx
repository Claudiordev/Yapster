import { ReactNode } from "react";

import { Icon } from "@/components/icon";

/** The leading icon for a nav item, keyed by its label. */
export function navIcon(label: string, size = 16): ReactNode {
  if (label === "Messages") return <Icon name="chat-bubble" size={size} />;
  if (label === "Settings") return <Icon name="settings" size={size} />;

  return null;
}
