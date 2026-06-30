"use client";

import { useState } from "react";
import { Button } from "@heroui/button";

import { CHAT_PANELS, type PanelKey } from "../_Panels/panels";

import { Icon } from "@/components/icon";
import { SettingsModal } from "@/components/SettingsModal";
import { ThemeSwitch } from "@/components/theme-switch";
import { siteConfig } from "@/config/site";
import { useAccount } from "@/lib/use-account";

interface ChatNavProps {
  activePanel: PanelKey | null;
  onSelectPanel: (panel: PanelKey | null) => void;
}

export function ChatNav({ activePanel, onSelectPanel }: ChatNavProps) {
  const { logout } = useAccount();
  const [settingsOpen, setSettingsOpen] = useState(false);

  function itemClass(active: boolean) {
    return `w-full justify-start ${
      active
        ? "bg-default-200 text-foreground font-medium data-[hover=true]:bg-default-300"
        : "text-default-500"
    }`;
  }

  return (
    <div className="flex-shrink-0 flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2 px-1">
        <span className="text-brand">
          <Icon name="logo" size={26} />
        </span>
        <span className="font-bold tracking-tight text-foreground">Yapp</span>
        <div className="flex-grow" />
        <a
          aria-label="GitHub"
          className="text-default-400 hover:text-foreground transition-colors"
          href={siteConfig.links.github}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Icon name="github" size={18} />
        </a>
        <ThemeSwitch />
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
            size="md"
            startContent={<Icon name={panel.icon} size={18} />}
            variant={activePanel === panel.key ? "flat" : "light"}
            onPress={() => onSelectPanel(panel.key)}
          >
            {panel.label}
          </Button>
        ))}

        {/* Settings — opens a modal. */}
        <Button
          className={itemClass(settingsOpen)}
          size="md"
          startContent={<Icon name="settings" size={18} />}
          variant={settingsOpen ? "flat" : "light"}
          onPress={() => setSettingsOpen(true)}
        >
          Settings
        </Button>

        <Button
          aria-label="Logout"
          className="w-full justify-start text-coral-300"
          size="md"
          startContent={<Icon name="logout" size={18} />}
          variant="light"
          onPress={logout}
        >
          Logout
        </Button>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
