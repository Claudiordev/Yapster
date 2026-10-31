"use client";

import { Button } from "@heroui/button";

import { CHAT_PANELS, type PanelKey } from "@/app/(protected)/message/_Components/_Panels/utils/panels";

import { useAccount } from "@/lib/hooks/useAccount";
import { Icon } from "@/components/Icon/Icon";
import { ThemeSwitch } from "@/components/ThemeSwitch/ThemeSwitch";

interface ChatNavProps {
  activePanel: PanelKey | null;
  onSelectPanel: (panel: PanelKey | null) => void;
}

export function ChatNav({ activePanel, onSelectPanel }: ChatNavProps) {
  const { isFeatureEnabled } = useAccount();

  function itemClass(active: boolean) {
    return `w-full justify-start ${
      active
        ? "page-nav-active text-foreground font-medium"
        : "text-default-500"
    }`;
  }

  return (
    <div className="flex flex-shrink-0 flex-col">
      {/* Messages — the main view; selecting it closes any open panel. */}
      <div className="flex h-14 items-center px-3">
        <Button
          className={itemClass(activePanel === null)}
          size="md"
          startContent={<Icon name="chat-bubble" size={18} />}
          variant={activePanel === null ? "flat" : "light"}
          onPress={() => onSelectPanel(null)}
        >
          Messages
        </Button>
      </div>

      {/* Feature views that open on top of the messages page. */}
      {CHAT_PANELS.filter((panel) => isFeatureEnabled(panel.key)).map((panel) => (
        <div key={panel.key} className="flex h-14 items-center px-3">
          <Button
            className={itemClass(activePanel === panel.key)}
            size="md"
            startContent={<Icon name={panel.icon} size={18} />}
            variant={activePanel === panel.key ? "flat" : "light"}
            onPress={() => onSelectPanel(panel.key)}
          >
            {panel.label}
          </Button>
        </div>
      ))}
    </div>
  );
}
