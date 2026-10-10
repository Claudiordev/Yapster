"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@heroui/avatar";

import type { CommunityServer, ServerChannel, ServerMember } from "@/types/server";

import { MessageText } from "../_Message/MessageText";
import { roleBadgeFor } from "./utils/channels";

interface ServerMessagesProps {
  server: CommunityServer;
  channel: ServerChannel;
  members: ServerMember[];
  youAvatarUrl: string | null;
  onOpenProfile: (member: ServerMember) => void;
}

/** Message list of a text or announcement channel, same rows as a conversation thread. */
export function ServerMessages({ server, channel, members, youAvatarUrl, onOpenProfile }: ServerMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = server.messages[channel.id] ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [channel.id, messages.length]);

  return (
    <div ref={scrollRef} className="flex min-h-0 flex-grow flex-col overflow-y-auto p-4">
      {messages.length === 0 ? (
        <p className="py-8 text-center text-sm text-default-400">No messages yet, say hi!</p>
      ) : (
        messages.map((m, i) => {
          const prev = messages[i - 1];

          if (m.system) {
            return (
              <p key={m.id} className="my-3 text-center text-tiny text-default-400 first:mt-0">
                {m.body}
              </p>
            );
          }

          const author = members.find((x) => x.id === m.authorId) ?? server.members.find((x) => x.id === m.authorId);
          const name = author?.username ?? "User";
          const tier = server.roles.find((r) => r.id === author?.roleId)?.tier ?? "member";
          const badge = roleBadgeFor(tier);
          const startsGroup = !prev || prev.system || prev.authorId !== m.authorId;
          const avatarUrl = author?.id === "you" ? (youAvatarUrl ?? undefined) : undefined;

          return (
            <div
              key={m.id}
              className={`-mx-4 flex gap-3 rounded-medium px-4 py-0.5 hover:bg-content2/60 ${
                startsGroup ? "mt-4 first:mt-0" : "mt-0.5"
              }`}
            >
              {startsGroup ? (
                <button
                  aria-label={`${name}'s profile`}
                  className="mt-0.5 flex-shrink-0 rounded-full"
                  type="button"
                  onClick={() => author && onOpenProfile(author)}
                >
                  <Avatar
                    className="bg-default-200 text-brand"
                    name={name.charAt(0).toUpperCase()}
                    size="sm"
                    src={avatarUrl}
                  />
                </button>
              ) : (
                <div aria-hidden className="w-8 flex-shrink-0" />
              )}

              <div className="min-w-0 flex-grow">
                {startsGroup && (
                  <div className="flex items-baseline gap-2">
                    <button
                      className="text-sm font-semibold text-foreground hover:underline"
                      type="button"
                      onClick={() => author && onOpenProfile(author)}
                    >
                      {name}
                    </button>
                    {badge && (
                      <span className={`call-role-badge self-center ${badge.className}`}>{badge.label}</span>
                    )}
                    {author?.bot && <span className="call-role-badge self-center call-role-badge--premium">BOT</span>}
                    <span className="text-[10px] text-default-400">{m.time}</span>
                  </div>
                )}
                <MessageText body={m.body} />
                {m.reactions && (
                  <div className="mt-1.5 flex gap-1.5">
                    {m.reactions.map((r) => (
                      <span
                        key={r.emoji}
                        className={`rounded-full border px-2 py-0.5 text-tiny ${
                          r.mine ? "border-brand/60 bg-brand/15 text-foreground" : "border-transparent bg-content2 text-default-600"
                        }`}
                      >
                        {r.emoji} {r.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
