"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import NextLink from "next/link";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";

import {
  ChatBubbleIcon,
  ChevronLeftIcon,
  GithubIcon,
  Logo,
} from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";
import { siteConfig } from "@/config/site";

const COLLAPSED_KEY = "sidebar.collapsed";

function iconFor(label: string) {
  if (label === "Messages") return <ChatBubbleIcon size={18} />;

  return null;
}

export function LeftSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSED_KEY) === "true") {
        setCollapsed(true);
      }
    } catch {
      // localStorage unavailable
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore quota errors
    }
  }, [collapsed, hydrated]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.username) setUsername(data.username);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={`flex-shrink-0 h-screen flex flex-col bg-content1 border-r border-divider shadow-sm transition-[width] duration-200 ${
        collapsed ? "w-16 items-center px-2 py-4 gap-3" : "w-60 p-4 gap-4"
      }`}
    >
      <button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`flex items-center justify-center rounded-medium p-1.5 text-default-400 hover:text-foreground hover:bg-default-100 transition-colors ${
          collapsed ? "self-center" : "self-end"
        }`}
        type="button"
        onClick={() => setCollapsed((c) => !c)}
      >
        <ChevronLeftIcon
          size={16}
          style={{
            transform: collapsed ? "rotate(180deg)" : "none",
            transition: "transform 200ms",
          }}
        />
      </button>

      <div
        className={`flex items-center gap-3 ${
          collapsed ? "justify-center" : "px-2"
        }`}
      >
        <Avatar
          className="bg-[#FF3B47] text-white flex-shrink-0 ring-2 ring-[#FF3B47]/20"
          name={(username ?? "U").charAt(0).toUpperCase()}
          size="sm"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs text-default-500 leading-tight">
              Welcome back,
            </p>
            <p className="text-sm font-semibold text-foreground truncate">
              {username ?? "…"}
            </p>
          </div>
        )}
      </div>

      <NextLink
        className={`flex items-center rounded-medium border border-divider hover:bg-default-100 transition-colors ${
          collapsed
            ? "justify-center w-10 h-10 bg-default-50"
            : "gap-2 px-2 py-1.5 bg-default-50"
        }`}
        href="/"
      >
        <span className="text-[#FF3B47]">
          <Logo size={collapsed ? 24 : 32} />
        </span>
        {!collapsed && (
          <p className="font-bold tracking-tight text-sm text-foreground">
            Yapster
          </p>
        )}
      </NextLink>

      <nav
        className={`flex flex-col gap-1 mt-2 ${collapsed ? "w-full" : ""}`}
      >
        {siteConfig.navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const icon = iconFor(item.label);

          const linkClass = `flex items-center rounded-medium text-sm transition-colors ${
            collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2.5"
          } ${
            isActive
              ? "bg-[#FF3B47] text-white font-semibold shadow-md shadow-[#FF3B47]/30"
              : "text-foreground hover:bg-default-100"
          }`;

          const content = (
            <NextLink key={item.href} className={linkClass} href={item.href}>
              {icon}
              {!collapsed && <span>{item.label}</span>}
            </NextLink>
          );

          return collapsed ? (
            <Tooltip key={item.href} content={item.label} placement="right">
              {content}
            </Tooltip>
          ) : (
            content
          );
        })}
      </nav>

      <div className="flex-grow" />

      <div
        className={`flex items-center gap-3 ${
          collapsed ? "flex-col" : "px-2"
        }`}
      >
        <a
          aria-label="GitHub"
          className="text-default-400 hover:text-foreground transition-colors"
          href={siteConfig.links.github}
          rel="noopener noreferrer"
          target="_blank"
        >
          <GithubIcon size={18} />
        </a>
        <ThemeSwitch />
      </div>

      <Tooltip content="Logout" isDisabled={!collapsed} placement="right">
        <Button
          aria-label="Logout"
          className={`bg-[#FF3B47] hover:bg-[#E62D3A] text-white shadow-sm ${
            collapsed ? "min-w-0 w-10 h-10 px-0" : ""
          }`}
          isIconOnly={collapsed}
          size="sm"
          variant="flat"
          onPress={handleLogout}
        >
          {collapsed ? "⏻" : "Logout"}
        </Button>
      </Tooltip>
    </aside>
  );
}
