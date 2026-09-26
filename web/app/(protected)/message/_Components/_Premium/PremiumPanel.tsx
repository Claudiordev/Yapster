"use client";

import PremiumPage from "./PremiumPage";

/**
 * Premium feature panel — the full page rendered as an overlay over the chat
 * area, like Events and Game servers; the left nav stays put. Closing returns
 * to messages.
 */
export function PremiumPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      <PremiumPage onClose={onClose} />
    </div>
  );
}
