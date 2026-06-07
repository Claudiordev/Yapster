"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CallModal } from "./call-modal";
import { ChatList } from "./chat-list";
import { ChatThread } from "./chat-thread";
import { ContactModal } from "./contact-modal";
import { useContacts } from "./use-contacts";
import { ChatMessage } from "./chat-types";

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

export function SmsPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeRecipient, setActiveRecipient] = useState<string | null>(null);
  const [draftRecipient, setDraftRecipient] = useState("");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<string | null>(null);
  const [callingRecipient, setCallingRecipient] = useState<string | null>(null);

  const { displayName, hasContact, setContactName } = useContacts();

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

  const activeMessages = activeRecipient
    ? (threadsByRecipient.get(activeRecipient) ?? [])
    : [];

  const currentRecipient = activeRecipient ?? draftRecipient;
  const canSend =
    messageText.trim().length > 0 && currentRecipient.trim().length > 0;

  function startNewChat() {
    setActiveRecipient(null);
    setDraftRecipient("");
    setMessageText("");
  }

  function openContactModal(recipient: string) {
    setEditingRecipient(recipient);
  }

  function closeContactModal() {
    setEditingRecipient(null);
  }

  function saveContact(name: string) {
    if (editingRecipient) {
      setContactName(editingRecipient, name);
    }
  }

  // After STATUS_REFRESH_DELAY_MS, pull the latest status for one specific message
  // by looking it up via providerId in the conversations endpoint.
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

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSend) return;

    const recipient = currentRecipient.trim();
    const body = messageText.trim();
    const tempId = crypto.randomUUID();

    const optimistic: ChatMessage = {
      id: tempId,
      body,
      to: recipient,
      status: "queued",
      pending: true,
      sentAt: Date.now(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setMessageText("");
    setActiveRecipient(recipient);
    setDraftRecipient("");
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
      // actual lifecycle status will land in `setTimeout` below once the
      // backend's delayed fetch + persist has run.
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
  }

  return (
    <>
      <div className="flex flex-row gap-4 flex-grow min-h-0">
        <ChatList
          activeRecipient={activeRecipient}
          displayName={displayName}
          hasContact={hasContact}
          recipients={recipients}
          onEditContact={openContactModal}
          onNewChat={startNewChat}
          onSelectRecipient={setActiveRecipient}
        />

        <ChatThread
          activeRecipient={activeRecipient}
          canSend={canSend}
          displayName={displayName}
          draftRecipient={draftRecipient}
          hasContact={hasContact}
          isSending={isSending}
          messageText={messageText}
          messages={activeMessages}
          onDraftRecipientChange={setDraftRecipient}
          onEditContact={openContactModal}
          onMessageTextChange={setMessageText}
          onSend={handleSend}
          onStartCall={setCallingRecipient}
        />
      </div>

      <ContactModal
        currentName={
          editingRecipient && hasContact(editingRecipient)
            ? displayName(editingRecipient)
            : ""
        }
        isOpen={editingRecipient !== null}
        phoneNumber={editingRecipient ?? ""}
        onClose={closeContactModal}
        onSave={saveContact}
      />

      <CallModal
        isOpen={callingRecipient !== null}
        recipientLabel={callingRecipient ? displayName(callingRecipient) : ""}
        recipientSubLabel={
          callingRecipient && hasContact(callingRecipient)
            ? callingRecipient
            : null
        }
        onEndCall={() => setCallingRecipient(null)}
      />
    </>
  );
}
