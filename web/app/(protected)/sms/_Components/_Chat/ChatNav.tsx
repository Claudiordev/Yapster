"use client";

import { Button } from "@heroui/button";

import { CHAT_PANELS, type PanelKey } from "../_Panels/panels";

import { Icon } from "@/components/icon";
import { ThemeSwitch } from "@/components/theme-switch";

interface ChatNavProps {
  activePanel: PanelKey | null;
  onSelectPanel: (panel: PanelKey | null) => void;
}

export function ChatNav({ activePanel, onSelectPanel }: ChatNavProps) {
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
            isDisabled={panel.comingSoon}
            size="md"
            startContent={<Icon name={panel.icon} size={18} />}
            variant={activePanel === panel.key ? "flat" : "light"}
            onPress={() => onSelectPanel(panel.key)}
          >
            {panel.label}
            {panel.comingSoon && (
              <span className="text-default-400"> - Coming Soon</span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
