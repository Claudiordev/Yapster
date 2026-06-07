"use client";

import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";

import { EditIcon } from "./edit-icon";
import { PhoneIcon } from "./phone-icon";
import { ChatMessage, formatTime } from "./chat-types";

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
    <aside className="w-72 flex-shrink-0 flex flex-col gap-3 min-h-0 bg-content1 border border-divider rounded-large p-3 shadow-sm">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Chats
        </h2>
        <Button
          className="bg-[#FF3B47] hover:bg-[#E62D3A] text-white"
          size="sm"
          variant="flat"
          onPress={onNewChat}
        >
          + New
        </Button>
      </div>

      <div className="h-px bg-divider" />

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
                    ? "bg-[#FF3B47] text-white shadow-md shadow-[#FF3B47]/25"
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
                  className={`flex-shrink-0 ${
                    isActive
                      ? "bg-white text-[#FF3B47] ring-1 ring-white/40"
                      : "bg-[#FF3B47]/10 text-[#FF3B47] ring-1 ring-[#FF3B47]/20"
                  }`}
                  icon={<PhoneIcon size={20} />}
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
                    {saved ? recipient : last.body}
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
                  <EditIcon size={16} />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
