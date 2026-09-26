"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";

import { Icon } from "@/components/Icon/Icon";
import { RoleBadge } from "@/components/RoleBadge/RoleBadge";
import { badgesForRoles } from "@/lib/roleBadges";
import type { UserIdentity } from "@/types/user";

const MIN_HEIGHT = 140;
const DEFAULT_HEIGHT = 220;
const MAX_PARENT_FRACTION = 0.6;
const KEYBOARD_STEP = 16;

interface CallPresenceStripProps {
  /** User ids in the call right now. */
  participantIds: string[];
  /** Name/avatar lookup for the conversation's members. */
  people: Record<string, UserIdentity>;
  onJoin: () => void;
}

/**
 * "A call is going on here": the participants' profile pictures only, with no per-user
 * tiles, label or call controls. Shown at the top of a conversation while its
 * call is active and you aren't in it; Join is the only action.
 */
export function CallPresenceStrip({
  participantIds,
  people,
  onJoin,
}: CallPresenceStripProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);

  if (participantIds.length === 0) return null;

  function clamp(value: number) {
    const parent =
      ref.current?.parentElement?.getBoundingClientRect().height ?? 0;
    const max =
      parent > 0 ? Math.max(MIN_HEIGHT, parent * MAX_PARENT_FRACTION) : 480;

    return Math.round(Math.min(max, Math.max(MIN_HEIGHT, value)));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, height };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (drag.current)
      setHeight(clamp(drag.current.height + event.clientY - drag.current.y));
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    setHeight(
      clamp(
        height + (event.key === "ArrowDown" ? KEYBOARD_STEP : -KEYBOARD_STEP),
      ),
    );
  }

  return (
    <div
      ref={ref}
      className="flex flex-shrink-0 flex-col bg-gradient-to-b from-content2 to-content1"
      style={{ height }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-4">
        <div className="flex min-h-0 flex-1 flex-wrap content-center items-center justify-center gap-x-5 gap-y-4 overflow-y-auto py-2">
          {participantIds.map((id) => {
            const person = people[id];
            const name = person?.name ?? "Unknown";
            const roleBadges = badgesForRoles(person?.roles);

            return (
              <div key={id} className="flex min-w-0 flex-col items-center">
                <div className="relative">
                  <Avatar
                    className="bg-brand text-white"
                    name={name.charAt(0).toUpperCase()}
                    size="lg"
                    src={person?.avatarUrl ?? undefined}
                  />
                  {roleBadges.length > 0 && (
                    <span className="absolute -bottom-1 -right-2 z-[1] flex flex-col items-end gap-1">
                      {roleBadges.map((badge) => (
                        <RoleBadge
                          key={badge.role}
                          badge={badge}
                          ownerName={name}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-shrink-0 items-center justify-center border-t border-white/5 pt-3">
          <Button
          isIconOnly
          aria-label="Join call"
          className="chat-profile-action chat-profile-action--send min-w-9"
          size="sm"
          title="Join call"
          variant="light"
          onPress={onJoin}
        >
          <Icon name="phone" size={18} />
        </Button>
        </div>
      </div>

      <div
        aria-label="Resize call panel"
        aria-orientation="horizontal"
        aria-valuenow={height}
        className="flex h-3 flex-shrink-0 touch-none cursor-row-resize items-center justify-center border-b border-divider outline-none transition-colors hover:bg-default-100 focus-visible:bg-default-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
        role="separator"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerCancel={onPointerEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
      >
        <span className="h-1 w-12 rounded-full bg-default-400" />
      </div>
    </div>
  );
}
