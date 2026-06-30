"use client";

import { Button } from "@heroui/button";

import { Icon, type IconName } from "@/components/icon";

interface AppPanelProps {
  title: string;
  icon: IconName;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A feature view that opens on top of the chat area (Discord-style) while the
 * left nav stays put. Fills the content area; closing returns to messages.
 */
export function AppPanel({ title, icon, onClose, children }: AppPanelProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background dark:bg-surface-chat">
      <header className="flex-shrink-0 flex items-center gap-2 px-4 h-14 border-b border-divider shadow-sm">
        <span className="text-brand">
          <Icon name={icon} size={20} />
        </span>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <div className="flex-grow" />
        <Button
          isIconOnly
          aria-label="Close"
          className="text-default-400 hover:text-foreground"
          size="sm"
          variant="light"
          onPress={onClose}
        >
          <Icon name="close" size={18} />
        </Button>
      </header>
      <div className="flex flex-col flex-grow min-h-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
