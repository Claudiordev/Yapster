"use client";

import { createContext, useContext } from "react";

import type { PanelKey } from "./utils/panels";

/** Lets views rendered inside the shell (e.g. Main) open one of its panels. */
export const OpenPanelContext = createContext<(panel: PanelKey | null) => void>(
  () => {},
);

export function useOpenPanel() {
  return useContext(OpenPanelContext);
}
