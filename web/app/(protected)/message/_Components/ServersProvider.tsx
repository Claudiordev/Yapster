"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useServersState, type ServersState } from "../_Actions/useServersState";

const ServersContext = createContext<ServersState | null>(null);

/** Mounted at the message layout so servers, messages and voice state survive navigation. */
export function ServersProvider({ children }: { children: ReactNode }) {
  const state = useServersState();

  return <ServersContext.Provider value={state}>{children}</ServersContext.Provider>;
}

export function useServers(): ServersState {
  const ctx = useContext(ServersContext);

  if (!ctx) throw new Error("useServers must be used inside <ServersProvider>");

  return ctx;
}
