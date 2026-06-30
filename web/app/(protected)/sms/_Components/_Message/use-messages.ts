"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ChatMessage } from "../chat-types";

import { randomId } from "@/lib/random-id";

interface ConversationDto {
  receiver: string;
  messages: {
    id: string;
    body: string;
    status: string;
    providerId?: string | null;
    errorMessage?: string | null;
    createdAt: string;
  }[];
}

const STATUS_REFRESH_DELAY_MS = 5_000;

/**
 * Owns the SMS message data: loads persisted conversations, groups them by
 * recipient, sends new messages optimistically, and reconciles delivery status.
 */
export function useMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Load persisted conversations on mount
  useEffect(() => {
    fetch("/api/sms/conversations")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((conversations: ConversationDto[]) => {
        const loaded: ChatMessage[] = conversations.flatMap((conv) =>
          conv.messages.map((m) => ({
            id: m.id,
            providerId: m.providerId ?? undefined,
            body: m.body,
            to: conv.receiver,
            status: m.status.toLowerCase(),
            pending: false,
            error: m.errorMessage ?? undefined,
            sentAt: new Date(m.createdAt).getTime(),
          })),
        );

        setMessages(loaded);
      })
      .catch(() => {
        // ignore — empty state if backend is down or returns nothing
      });
  }, []);

  const { threadsByRecipient, recipients } = useMemo(() => {
    const grouped = new Map<string, ChatMessage[]>();

    for (const msg of messages) {
      const arr = grouped.get(msg.to) ?? [];

      arr.push(msg);
      grouped.set(msg.to, arr);
    }
    Array.from(grouped.values()).forEach((arr) =>
      arr.sort((a, b) => a.sentAt - b.sentAt),
    );
    const sortedRecipients = Array.from(grouped.entries()).sort(
      ([, a], [, b]: [string, ChatMessage[]]) =>
        b[b.length - 1].sentAt - a[a.length - 1].sentAt,
    );

    return { threadsByRecipient: grouped, recipients: sortedRecipients };
  }, [messages]);

  // After STATUS_REFRESH_DELAY_MS, pull the latest status for one specific
  // message by looking it up via providerId in the conversations endpoint.
  const refreshStatus = useCallback(
    async (tempId: string, recipient: string, providerId: string) => {
      try {
        const res = await fetch("/api/sms/conversations");

        if (!res.ok) return;
        const conversations: ConversationDto[] = await res.json();
        const conv = conversations.find((c) => c.receiver === recipient);

        if (!conv) return;
        const updated = conv.messages.find((m) => m.providerId === providerId);

        if (!updated) return;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: updated.status.toLowerCase(),
                  error: updated.errorMessage ?? m.error,
                }
              : m,
          ),
        );
      } catch {
        // ignore — message keeps "queued"
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (recipient: string, body: string) => {
      const tempId = randomId();

      const optimistic: ChatMessage = {
        id: tempId,
        body,
        to: recipient,
        status: "queued",
        pending: true,
        sentAt: Date.now(),
      };

      setMessages((prev) => [...prev, optimistic]);
      setIsSending(true);

      try {
        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiver: recipient, message: body }),
        });

        if (!res.ok) {
          const data = await res.json();

          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    pending: false,
                    status: "failed",
                    error: data.error || "Send failed",
                  }
                : m,
            ),
          );

          return;
        }

        const data = await res.json();

        // Show as "queued" regardless of the provider's immediate response; the
        // actual lifecycle status lands in the delayed refresh below.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  pending: false,
                  status: "queued",
                  providerId: data.providerId,
                  price: data.price ?? undefined,
                  priceUnit: data.priceUnit ?? undefined,
                }
              : m,
          ),
        );

        if (data.providerId) {
          window.setTimeout(() => {
            refreshStatus(tempId, recipient, data.providerId);
          }, STATUS_REFRESH_DELAY_MS);
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  pending: false,
                  status: "failed",
                  error: "Network error. Please try again.",
                }
              : m,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [refreshStatus],
  );

  const getThread = useCallback(
    (recipient: string | null) =>
      recipient ? (threadsByRecipient.get(recipient) ?? []) : [],
    [threadsByRecipient],
  );

  return { recipients, getThread, sendMessage, isSending };
}
