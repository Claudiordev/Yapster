"use client";

import { useState } from "react";
import { Button } from "@heroui/button";

import { Icon } from "@/components/Icon/Icon";

/** An event's room code in a box, with a copy button. `compact` is the smaller sidebar size. */
export function RoomCode({
  code,
  compact = false,
}: {
  code: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is still on screen.
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex flex-grow items-center justify-center rounded-medium border border-[#46424d] bg-[#18191d] font-mono font-bold text-foreground ${
          compact
            ? "h-11 text-lg tracking-[0.3em]"
            : "h-14 text-3xl tracking-[0.35em]"
        }`}
      >
        {code}
      </div>
      <Button
        isIconOnly
        aria-label="Copy room code"
        className={`chat-profile-action chat-profile-settings min-w-0 ${compact ? "!h-11 w-11" : "!h-14 w-14"}`}
        variant="light"
        onPress={copy}
      >
        <Icon name={copied ? "check" : "copy"} size={compact ? 16 : 18} />
      </Button>
    </div>
  );
}
