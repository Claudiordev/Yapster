"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";

import { Icon } from "@/components/icon";
import { navIcon } from "@/components/nav-icon";
import { SettingsModal } from "@/components/SettingsModal";
import { ThemeSwitch } from "@/components/theme-switch";
import { siteConfig } from "@/config/site";
import { isActivePath } from "@/lib/is-active-path";
import { useAccount } from "@/lib/use-account";

/**
 * Horizontal nav + logout bar for the non-chat protected pages (e.g. Settings).
 * The chat page renders its own compact menu inside the left column instead.
 */
export function AppTopBar() {
  const pathname = usePathname();
  const { username, logout } = useAccount();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="flex-shrink-0 h-14 flex items-center gap-2 px-4 bg-content1 border-b border-divider">
      <NextLink
        className="flex items-center gap-2 mr-1 text-foreground hover:opacity-80 transition-opacity"
        href="/sms"
      >
        <span className="text-brand">
          <Icon name="logo" size={26} />
        </span>
        <span className="hidden font-bold tracking-tight sm:inline">Yapp</span>
      </NextLink>

      <nav className="flex items-center gap-1">
        {siteConfig.navItems.map((item) => {
          const isSettings = item.label === "Settings";
          const isActive = isSettings
            ? settingsOpen
            : isActivePath(pathname, item.href);
          const className = isActive
            ? "bg-default-200 text-foreground font-medium data-[hover=true]:bg-default-300"
            : "text-default-500";

          if (isSettings) {
            return (
              <Button
                key={item.href}
                className={className}
                size="sm"
                startContent={navIcon(item.label, 16)}
                variant={isActive ? "flat" : "light"}
                onPress={() => setSettingsOpen(true)}
              >
                {item.label}
              </Button>
            );
          }

          return (
            <Button
              key={item.href}
              as={NextLink}
              className={className}
              href={item.href}
              size="sm"
              startContent={navIcon(item.label, 16)}
              variant={isActive ? "flat" : "light"}
            >
              {item.label}
            </Button>
          );
        })}
      </nav>

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

      {username && (
        <div className="hidden items-center gap-2 ml-1 sm:flex">
          <Avatar
            className="bg-brand text-white ring-2 ring-brand/20"
            name={username.charAt(0).toUpperCase()}
            size="sm"
          />
          <span className="text-sm font-medium text-foreground">
            {username}
          </span>
        </div>
      )}

      <Button
        aria-label="Logout"
        className="ml-1 text-coral-300"
        size="sm"
        variant="light"
        onPress={logout}
      >
        Logout
      </Button>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </header>
  );
}
