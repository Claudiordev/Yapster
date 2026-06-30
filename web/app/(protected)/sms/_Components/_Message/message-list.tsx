"use client";

import { Fragment, useEffect, useRef } from "react";

import { MessageItem } from "./message-item";
import { ChatMessage, formatDateDivider, isSameDay } from "../chat-types";
import { useAccount } from "@/lib/use-account";

interface MessageListProps {
  messages: ChatMessage[];
  hasRecipient: boolean;
  // Used only to re-trigger the scroll-to-bottom when switching chats.
  activeRecipient: string | null;
}

// Messages closer than this from the same sender are grouped under one header.
const GROUP_GAP_MS = 5 * 60 * 1000;

export function MessageList({
  messages,
  hasRecipient,
  activeRecipient,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { username } = useAccount();

  const senderName = username ?? "You";
  const senderInitial = senderName.charAt(0).toUpperCase();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeRecipient]);

  return (
    <div className="flex-grow overflow-y-auto flex flex-col min-h-0 px-4 py-3">
      {messages.length === 0 && (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-default-400 text-center text-sm">
            {hasRecipient
              ? "This is the beginning of your conversation."
              : "Enter a phone number to start a new chat."}
          </p>
        </div>
      )}

      {messages.map((msg, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const newDay = !prev || !isSameDay(prev.sentAt, msg.sentAt);
        const showHeader =
          !prev || newDay || msg.sentAt - prev.sentAt > GROUP_GAP_MS;

        return (
          <Fragment key={msg.id}>
            {newDay && (
              <div className="relative flex items-center py-3">
                <div className="flex-grow h-px bg-divider" />
                <span className="px-2 text-tiny font-semibold text-default-400">
                  {formatDateDivider(msg.sentAt)}
                </span>
                <div className="flex-grow h-px bg-divider" />
              </div>
            )}

            <MessageItem
              message={msg}
              senderInitial={senderInitial}
              senderName={senderName}
              showHeader={showHeader}
              topSpacing={showHeader && !newDay}
            />
          </Fragment>
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
}
