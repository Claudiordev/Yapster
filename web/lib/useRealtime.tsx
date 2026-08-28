"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReconnectingWebSocket from "reconnecting-websocket";

import type { ClientEvent, EventType, ServerEvent } from "@/lib/chat";

export type ConnectionStatus = "disabled" | "connecting" | "open" | "closed";

/** Handler for one event type — receives the narrowed event (e.g. MessageEvent). */
type Handler<T extends EventType> = (
  event: Extract<ServerEvent, { type: T }>,
) => void;

interface Realtime {
  status: ConnectionStatus;
  subscribe: <T extends EventType>(type: T, handler: Handler<T>) => () => void;
  /** Send an event UP the socket. No-ops while disconnected — callers are
   *  ephemeral signals (typing) where a dropped frame doesn't matter. */
  send: (event: ClientEvent) => void;
}

const RealtimeContext = createContext<Realtime | null>(null);

/**
 * The WebSocket base the browser dials. An explicit NEXT_PUBLIC_CHAT_WS_URL
 * wins (e.g. a dedicated WS host in production); otherwise it's derived from the
 * page's own origin, so the socket always targets the SAME host and port used
 * to load the app. In production that is wss://www.guildvo.com/ws on port 443;
 * the edge proxy routes /ws to chat internally.
 */
function resolveWsBase(): string | null {
  const override = process.env.NEXT_PUBLIC_CHAT_WS_URL;

  if (override) return override;
  if (typeof window === "undefined") return null;

  const proto = window.location.protocol === "https:" ? "wss" : "ws";

  return `${proto}://${window.location.host}/ws`;
}

/**
 * The single chat WebSocket for the session — receive-only. Mounted in the
 * protected layout; auto-reconnects and re-fetches a fresh `?token=` per
 * connect. Features `subscribe(type, handler)` and get the narrowed event.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const handlers = useRef(new Map<EventType, Set<(e: ServerEvent) => void>>());
  const socketRef = useRef<ReconnectingWebSocket | null>(null);

  const subscribe = useCallback(
    <T extends EventType>(type: T, handler: Handler<T>) => {
      const listener = handler as (e: ServerEvent) => void;
      const set = handlers.current.get(type) ?? new Set();

      set.add(listener);
      handlers.current.set(type, set);

      return () => set.delete(listener);
    },
    [],
  );

  useEffect(() => {
    const wsBase = resolveWsBase();

    if (!wsBase) {
      setStatus("disabled");

      return;
    }

    // The chat handshake authenticates via ?token=<jwt>; reject (retry) if none.
    const nextUrl = async () => {
      const res = await fetch("/api/chat/token", { method: "POST" });
      const token = res.ok ? (await res.json()).token : null;

      if (!token) throw new Error("No chat token available");

      return `${wsBase}?token=${encodeURIComponent(token)}`;
    };

    const socket = new ReconnectingWebSocket(nextUrl, [], {
      minReconnectionDelay: 1000,
      maxReconnectionDelay: 15000,
    });

    socketRef.current = socket;

    socket.onopen = () => setStatus("open");
    socket.onclose = () => setStatus("closed");
    socket.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ServerEvent;

        handlers.current.get(event.type)?.forEach((handle) => handle(event));
      } catch {
        // ignore non-JSON frames
      }
    };

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, []);

  const send = useCallback((event: ClientEvent) => {
    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(event));
  }, []);

  return (
    <RealtimeContext.Provider value={{ status, subscribe, send }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): Realtime {
  const ctx = useContext(RealtimeContext);

  if (!ctx) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }

  return ctx;
}
