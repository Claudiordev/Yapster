"use client";

import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";

import { ChatMessage, formatTime } from "../chat-types";
import { Icon } from "@/components/icon";

interface ChatListProps {
  recipients: [string, ChatMessage[]][];
  activeRecipient: string | null;
  displayName: (phoneNumber: string) => string;
  hasContact: (phoneNumber: string) => boolean;
  onSelectRecipient: (recipient: string) => void;
  onEditContact: (recipient: string) => void;
  onNewChat: () => void;
}

export function ChatList({
  recipients,
  activeRecipient,
  displayName,
  hasContact,
  onSelectRecipient,
  onEditContact,
  onNewChat,
}: ChatListProps) {
  return (
    <aside className="flex-grow flex flex-col gap-3 min-h-0 p-3">
      <div className="flex items-center justify-between px-2 pt-1">
        <span className="text-tiny font-semibold uppercase tracking-wide text-default-500">
          Chats
        </span>
        <Button
          isIconOnly
          aria-label="New chat"
          className="text-default-400 hover:text-foreground"
          size="sm"
          variant="light"
          onPress={onNewChat}
        >
          <span className="text-lg leading-none">+</span>
        </Button>
      </div>

      <div className="flex-grow overflow-y-auto flex flex-col gap-1 min-h-0">
        {recipients.length === 0 ? (
          <p className="text-default-400 text-sm text-center py-4">
            No conversations yet.
          </p>
        ) : (
          recipients.map(([recipient, thread]) => {
            const last = thread[thread.length - 1];
            const isActive = recipient === activeRecipient;
            const name = displayName(recipient);
            const saved = hasContact(recipient);

            return (
              <div
                key={recipient}
                aria-label={`Open chat with ${name}`}
                aria-pressed={isActive}
                className={`group flex items-center gap-3 text-left p-3 rounded-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-brand-deep text-white"
                    : "text-foreground hover:bg-default-100"
                }`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectRecipient(recipient)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectRecipient(recipient);
                  }
                }}
              >
                <Avatar
                  className="flex-shrink-0 bg-default-200 text-brand ring-1 ring-default-300"
                  icon={<Icon name="phone" size={20} />}
                  size="md"
                />

                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-medium truncate">{name}</span>
                    <span
                      className={`text-tiny flex-shrink-0 ${
                        isActive ? "text-white/80" : "text-default-500"
                      }`}
                    >
                      {formatTime(last.sentAt)}
                    </span>
                  </div>
                  <p
                    className={`text-tiny truncate ${
                      isActive ? "text-white/85" : "text-default-500"
                    }`}
                  >
                    {last.body}
                  </p>
                </div>

                <Button
                  isIconOnly
                  aria-label={
                    saved
                      ? `Edit contact ${name}`
                      : `Add ${recipient} to contacts`
                  }
                  className={`flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 ${
                    isActive
                      ? "text-white/90 hover:text-white"
                      : "text-default-400 hover:text-foreground"
                  }`}
                  size="sm"
                  variant="light"
                  onPress={() => onEditContact(recipient)}
                >
                  <Icon name="edit" size={16} />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
