"use client";

import GameServersPage from "./GameServersPage";

/**
 * Game Servers feature panel — the full page rendered as an overlay over the
 * chat area (Discord-style); the left nav stays put. Closing returns to messages.
 */
export function GameServersPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      <GameServersPage onClose={onClose} />
    </div>
  );
}
