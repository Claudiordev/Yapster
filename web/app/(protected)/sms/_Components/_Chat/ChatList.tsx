"use client";

import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";

import { StatusDot } from "./StatusDot";

import { Icon } from "@/components/icon";
import { conversationName, isUnread, type Conversation } from "@/lib/chat";

interface ChatListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  onSelect: (conversationId: string) => void;
  onNewChat: () => void;
}

/** Placeholder rows shown while the conversations request is in flight. */
function ChatListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="flex-shrink-0 w-10 h-10 rounded-full" />
          <div className="flex-grow min-w-0 flex flex-col gap-2">
            <Skeleton className="h-3 w-2/5 rounded-md" />
            <Skeleton className="h-3 w-3/5 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Short time-of-day label for a conversation's last activity (e.g. "14:32"). */
function timeLabel(iso: string | null): string {
  if (!iso) return "";

  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatList({
  conversations,
  activeConversationId,
  isLoading,
  onSelect,
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
          <Icon name="plus" size={16} />
        </Button>
      </div>

      <div
        aria-busy={isLoading}
        className="flex-grow min-h-0 flex flex-col gap-1.5 overflow-y-auto"
      >
        {isLoading ? (
          <ChatListSkeleton />
        ) : conversations.length === 0 ? (
          <p className="text-default-400 text-sm text-center py-4">
            No conversations yet.
          </p>
        ) : (
          conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId;
            const isGroup = conversation.type === "GROUP";
            const name = conversationName(conversation);
            const avatarUrl = isGroup
              ? undefined
              : (conversation.members[0]?.avatarUrl ?? undefined);
            const unread = !isActive && isUnread(conversation);
            const preview =
              conversation.lastMessage ??
              (conversation.type === "GROUP" ? "Group" : "No messages yet");

            return (
              <button
                key={conversation.id}
                aria-pressed={isActive}
                className={`group flex items-center gap-3 rounded-medium border-2 border-transparent p-3 text-left transition-[background-color,border-color,box-shadow] ${
                  isActive
                    ? "chat-conversation-active text-white"
                    : "text-foreground hover:bg-default-100"
                }`}
                type="button"
                onClick={() => onSelect(conversation.id)}
              >
                <div className="relative flex-shrink-0">
                  <Avatar
                    className="bg-default-200 text-brand ring-1 ring-default-300"
                    icon={isGroup ? <Icon name="users" size={20} /> : undefined}
                    name={isGroup ? undefined : name.charAt(0).toUpperCase()}
                    size="md"
                    src={avatarUrl}
                  />
                  {!isGroup && (
                    <StatusDot
                      className="absolute bottom-0 right-0"
                      name={name}
                      status={conversation.members[0]?.status}
                    />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate block ${unread ? "font-semibold" : "font-medium"}`}
                    >
                      {name}
                    </span>
                    <span
                      className={`text-tiny flex-shrink-0 ${
                        isActive ? "text-white/70" : "text-default-400"
                      }`}
                    >
                      {timeLabel(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-tiny truncate ${
                        isActive
                          ? "text-white/85"
                          : unread
                            ? "text-foreground font-medium"
                            : "text-default-500"
                      }`}
                    >
                      {preview}
                    </p>
                    {unread && (
                      <span
                        aria-label={`${conversation.unreadCount} unread`}
                        className="flex-shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-brand text-white text-tiny font-semibold flex items-center justify-center"
                      >
                        {conversation.unreadCount > 99
                          ? "99+"
                          : conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
