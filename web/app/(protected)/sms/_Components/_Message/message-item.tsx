"use client";

import { Avatar } from "@heroui/avatar";
import { Spinner } from "@heroui/spinner";

import { ChatMessage, formatClock, formatMessageStamp } from "../chat-types";

interface MessageItemProps {
  message: ChatMessage;
  // First message of a group → renders the avatar + sender name + timestamp.
  showHeader: boolean;
  // Extra top spacing between groups within the same day.
  topSpacing: boolean;
  senderName: string;
  senderInitial: string;
}

export function MessageItem({
  message,
  showHeader,
  topSpacing,
  senderName,
  senderInitial,
}: MessageItemProps) {
  const pending = message.pending && !message.error;

  return (
    <div
      className={`group flex gap-3 rounded-md px-2 py-0.5 hover:bg-default-100/50 ${
        topSpacing ? "mt-3" : ""
      } ${showHeader ? "" : "items-baseline"}`}
    >
      {showHeader ? (
        <Avatar
          className="bg-brand text-white flex-shrink-0 mt-0.5 ring-2 ring-brand/20"
          name={senderInitial}
          style={{ width: 40, height: 40 }}
        />
      ) : (
        <div className="w-10 flex-shrink-0 flex justify-end">
          <span className="text-[10px] leading-5 text-default-400 opacity-0 group-hover:opacity-100 tabular-nums">
            {formatClock(message.sentAt)}
          </span>
        </div>
      )}

      <div className="min-w-0 flex-grow">
        {showHeader && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {senderName}
            </span>
            <span className="text-tiny text-default-400">
              {formatMessageStamp(message.sentAt)}
            </span>
          </div>
        )}
        <p
          className={`text-sm text-foreground break-words whitespace-pre-wrap ${
            pending ? "opacity-60" : ""
          }`}
        >
          {message.body}
        </p>
        {pending && (
          <span className="mt-1 inline-flex text-default-400">
            <Spinner color="current" size="sm" />
          </span>
        )}
        {message.error && (
          <span className="text-danger text-tiny">{message.error}</span>
        )}
      </div>
    </div>
  );
}
