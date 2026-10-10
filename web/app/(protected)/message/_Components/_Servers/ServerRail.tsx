"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/toast";
import { Tooltip } from "@heroui/tooltip";

import { Icon, type IconName } from "@/components/Icon/Icon";

import { useServers } from "../ServersProvider";
import { CreateServerModal } from "./CreateServerModal";

interface RailKeyProps {
  label: string;
  active?: boolean;
  /** Server icon picture; fills the whole key. */
  image?: string;
  onPress: () => void;
  children?: React.ReactNode;
}

/** One raised key on the rail: the same button the profile card and composer use, only bigger. */
function RailKey({ label, active = false, image, onPress, children }: RailKeyProps) {
  return (
    <Tooltip content={label} delay={200} placement="right">
      <Button
        isIconOnly
        aria-current={active ? "true" : undefined}
        aria-label={label}
        className={`chat-profile-action !h-14 !w-14 !min-w-14 flex-shrink-0 overflow-hidden !rounded-[16px] p-0 text-base font-bold ${
          active ? "chat-profile-action--send ring-2 ring-brand ring-offset-2 ring-offset-content1 dark:ring-offset-surface-sidebar" : "chat-profile-settings"
        }`}
        variant="light"
        onPress={onPress}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-full w-full object-cover" src={image} />
        ) : (
          children
        )}
      </Button>
    </Tooltip>
  );
}

function RailIcon({ name }: { name: IconName }) {
  return <Icon name={name} size={26} />;
}

/**
 * The strip on the far left: home (direct messages), one key per server the user belongs
 * to, "+" to create one and search to explore communities.
 */
export function ServerRail() {
  const router = useRouter();
  const params = useParams<{ serverId?: string }>();
  const { servers, createServer } = useServers();
  const [createOpen, setCreateOpen] = useState(false);

  const activeServerId = params.serverId ?? null;

  return (
    <nav
      aria-label="Your servers"
      className="flex w-[92px] flex-shrink-0 flex-col items-center gap-3.5 border-r border-default-200 bg-content1 py-3 dark:border-surface-border dark:bg-surface-sidebar"
    >
      <RailKey active={activeServerId === null} label="Messages" onPress={() => router.push("/message")}>
        <RailIcon name="chat-bubble" />
      </RailKey>

      <div aria-hidden className="h-px w-10 flex-shrink-0 bg-divider" />

      <div className="flex min-h-0 flex-col items-center gap-3.5 overflow-y-auto px-3 py-1 [scrollbar-width:none]">
        {servers.map((s) => (
          <div key={s.id} className="relative">
            <RailKey
              active={s.id === activeServerId}
              image={s.iconUrl}
              label={s.name}
              onPress={() => router.push(`/message/server/${s.id}`)}
            >
              {s.short}
            </RailKey>
            {s.unread && s.id !== activeServerId ? (
              <span
                aria-label={`${s.unread} unread`}
                className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-tiny font-semibold text-white ring-2 ring-content1 dark:ring-surface-sidebar"
              >
                {s.unread}
              </span>
            ) : null}
          </div>
        ))}

        <RailKey label="Create a server" onPress={() => setCreateOpen(true)}>
          <RailIcon name="plus" />
        </RailKey>
      </div>

      <div className="flex-grow" />

      <RailKey
        label="Explore communities"
        onPress={() => addToast({ title: "Explore communities is coming later", color: "default" })}
      >
        <RailIcon name="search" />
      </RailKey>

      <CreateServerModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(name, template, iconUrl) => {
          const created = createServer(name, template, iconUrl);

          addToast({ title: `Created ${name}. You are the owner.`, color: "success" });
          router.push(`/message/server/${created.id}`);
        }}
      />
    </nav>
  );
}
