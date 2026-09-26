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
    <div className="flex flex-shrink-0 flex-col gap-2 p-3">
      <div className="flex items-center gap-2 px-1">
      </div>

      <div className="flex flex-col gap-1">
        {/* Messages — the main view; selecting it closes any open panel. */}
        <Button
          className={itemClass(activePanel === null)}
          size="md"
          startContent={<Icon name="chat-bubble" size={18} />}
          variant={activePanel === null ? "flat" : "light"}
          onPress={() => onSelectPanel(null)}
        >
          Messages
        </Button>

        {/* Feature views that open on top of the messages page. */}
        {CHAT_PANELS.map((panel) => (
          <Button
            key={panel.key}
            className={itemClass(activePanel === panel.key)}
            isDisabled={!isFeatureEnabled(panel.key)}
            size="md"
            startContent={<Icon name={panel.icon} size={18} />}
            variant={activePanel === panel.key ? "flat" : "light"}
            onPress={() => onSelectPanel(panel.key)}
          >
            {panel.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
