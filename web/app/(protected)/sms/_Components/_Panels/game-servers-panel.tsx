"use client";

import { useState } from "react";

import { CreateServerModal } from "./create-server-modal";

import { Icon } from "@/components/icon";

/**
 * An empty "add a game server" slot: a login-style card (rounded, bordered,
 * bg-content2) holding a smaller, darker inner card with a big lighter plus.
 */
function AddServerCard({ onPress }: { onPress: () => void }) {
  return (
    <button
      aria-label="Add a game server"
      className="group flex items-center justify-center rounded-medium border border-divider bg-content2 shadow-xl transition-transform hover:scale-[1.02]"
      type="button"
      onClick={onPress}
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-medium bg-content1 text-default-400 shadow-inner transition-colors group-hover:text-brand">
        <Icon name="plus" size={48} />
      </div>
    </button>
  );
}

export function GameServersPanel() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      {/* 20% banner on top, ~75% grid below, the rest as margin around both. */}
      <div className="grid h-full grid-rows-[20%_75%] gap-[2%] p-[2%]">
        {/* Banner — full width, with room for animated content. */}
        <div className="relative w-full overflow-hidden rounded-medium border border-divider shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-deep via-brand-deep to-brand-hover" />
          {/* Animated decorative orbs. */}
          <div className="absolute -left-6 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/10 blur-xl animate-pulse" />
          <div className="absolute right-10 top-2 h-16 w-16 rounded-full bg-white/10 blur-lg animate-pulse [animation-delay:0.5s]" />
          <div className="absolute bottom-0 right-1/3 h-20 w-20 rounded-full bg-black/10 blur-xl animate-pulse [animation-delay:1s]" />
          <div className="relative z-10 flex h-full flex-col items-start justify-center gap-1 px-8">
            <h2 className="text-2xl font-bold text-white drop-shadow">
              Game Servers
            </h2>
            <p className="text-sm text-white/80">
              Spin up a server and invite your friends.
            </p>
          </div>
        </div>

        {/* 2×2 grid of add-server cards. */}
        <div className="grid grid-cols-2 grid-rows-2 gap-[2%]">
          <AddServerCard onPress={() => setAddOpen(true)} />
          <AddServerCard onPress={() => setAddOpen(true)} />
          <AddServerCard onPress={() => setAddOpen(true)} />
          <AddServerCard onPress={() => setAddOpen(true)} />
        </div>
      </div>

      <CreateServerModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
