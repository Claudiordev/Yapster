"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";

import { Icon } from "@/components/Icon/Icon";
import type { ServerChannel, ServerMember } from "@/types/server";

interface ServerVoiceRoomProps {
  channel: ServerChannel;
  members: ServerMember[];
  connected: boolean;
  youAvatarUrl: string | null;
  onJoin: () => void;
  onLeave: () => void;
}

/** Voice channel view: participant tiles and call keys, styled like the call panel. Mocked, no media. */
export function ServerVoiceRoom({ channel, members, connected, youAvatarUrl, onJoin, onLeave }: ServerVoiceRoomProps) {
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);

  const others = (channel.voiceMembers ?? [])
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is ServerMember => Boolean(m));
  const everyone = connected ? [...others, members[0]] : others;

  return (
    <div className="flex min-h-0 flex-grow flex-col bg-gradient-to-b from-content2 to-content1">
      {everyone.length === 0 ? (
        <div className="flex flex-grow flex-col items-center justify-center gap-1 text-center">
          <h2 className="text-lg font-bold text-foreground">Nobody is here yet</h2>
          <p className="text-sm text-default-500">Join to start talking. Anyone with CONNECT can hop in.</p>
        </div>
      ) : (
        <div className="grid flex-grow grid-cols-[repeat(auto-fit,minmax(220px,1fr))] content-center gap-2 p-4">
          {everyone.map((m) => {
            const speaking = m.id === "maya";
            const isMuted = m.id === "echo" || (m.id === "you" && (muted || deafened));

            return (
              <div
                key={m.id}
                className={`relative aspect-[4/3] w-full overflow-hidden rounded-large border bg-content2 transition-[border-color,box-shadow] duration-150 ${
                  speaking
                    ? "border-success/60 shadow-[0_0_0_1px_rgba(97,217,139,0.25),0_0_18px_rgba(97,217,139,0.18)]"
                    : "border-white/10"
                }`}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(181,140,255,0.13),transparent_42%)]"
                />
                <div className="absolute inset-0 grid place-items-center">
                  <div className={`relative rounded-full p-1 ${speaking ? "ring-2 ring-success" : ""}`}>
                    <Avatar
                      className="bg-brand text-white"
                      name={m.username.charAt(0).toUpperCase()}
                      size="lg"
                      src={m.id === "you" ? (youAvatarUrl ?? undefined) : undefined}
                    />
                    {isMuted && (
                      <span
                        aria-label={`${m.username} is muted`}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white ring-2 ring-content1"
                        title="Muted"
                      >
                        <Icon name="mic-off" size={11} />
                      </span>
                    )}
                  </div>
                </div>
                <span className="absolute bottom-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-small border border-white/10 bg-black/70 px-2 py-1 text-tiny font-bold text-white backdrop-blur-sm">
                  <span className="truncate">{m.username}</span>
                  {speaking && (
                    <i className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success shadow-[0_0_0_2px_rgba(97,217,139,0.25)]" />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-shrink-0 items-center justify-center gap-2 border-t border-white/5 py-3">
        {connected ? (
          <>
            <Button
              isIconOnly
              aria-label={muted ? "Unmute" : "Mute"}
              aria-pressed={muted}
              className={`call-control ${muted ? "call-control--off" : ""}`}
              disableAnimation
              radius="none"
              variant="light"
              onPress={() => setMuted((v) => !v)}
            >
              <Icon name={muted ? "mic-off" : "mic"} size={16} />
            </Button>
            <Button
              isIconOnly
              aria-label={deafened ? "Undeafen" : "Deafen"}
              aria-pressed={deafened}
              className={`call-control ${deafened ? "call-control--off" : ""}`}
              disableAnimation
              radius="none"
              variant="light"
              onPress={() => setDeafened((v) => !v)}
            >
              <Icon name={deafened ? "headphones-off" : "headphones"} size={16} />
            </Button>
            <Button
              isIconOnly
              aria-label={sharing ? "Stop sharing screen" : "Share screen"}
              aria-pressed={sharing}
              className={`call-control ${sharing ? "call-control--active" : ""}`}
              disableAnimation
              radius="none"
              variant="light"
              onPress={() => setSharing((v) => !v)}
            >
              <Icon name="screen-share" size={16} />
            </Button>
            <Button
              isIconOnly
              aria-label="Leave voice"
              className="call-control call-control--end"
              disableAnimation
              radius="none"
              variant="light"
              onPress={onLeave}
            >
              <Icon className="rotate-[135deg]" name="phone" size={16} />
            </Button>
          </>
        ) : (
          <Button
            className="btn-coral min-h-[45px] rounded-[10px] px-6 text-sm font-bold"
            startContent={<Icon name="phone" size={16} />}
            onPress={onJoin}
          >
            Join voice
          </Button>
        )}
      </div>
    </div>
  );
}
