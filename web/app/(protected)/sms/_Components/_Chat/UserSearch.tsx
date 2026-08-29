"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Input } from "@heroui/input";

import { useUserSearch } from "./useUserSearch";

import { Icon } from "@/components/icon";
import type { PlatformUser } from "@/app/api/users/search/route";

interface UserSearchProps {
  onStartConversation: (user: PlatformUser) => void;
}

/** Search users by name and start a DM with one. Owns its own query state. */
export function UserSearch({ onStartConversation }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { users, loading, hasMore, loadMore } = useUserSearch(query);

  function handleScroll(e: React.UIEvent<HTMLUListElement>) {
    const el = e.currentTarget;

    if (
      hasMore &&
      !loading &&
      el.scrollHeight - el.scrollTop - el.clientHeight < 48
    ) {
      loadMore();
    }
  }

  return (
    <div className="relative w-full">
      <div className="rounded-large bg-content2 px-3 py-1.5">
        <Input
          aria-label="Search users"
          autoComplete="off"
          classNames={{
            inputWrapper:
              "bg-transparent shadow-none data-[hover=true]:bg-transparent group-data-[focus=true]:bg-transparent px-0",
            input: "text-sm",
          }}
          data-1p-ignore="true"
          data-lpignore="true"
          placeholder="Search users to message"
          startContent={
            <Icon className="text-default-400 flex-shrink-0" name="search" size={18} />
          }
          value={query}
          variant="flat"
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onFocusCapture={() => setOpen(true)}
          onValueChange={(v) => {
            setQuery(v);
            setOpen(true);
          }}
        />
      </div>

      {open && (users.length > 0 || loading) && (
        <ul
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-medium border border-divider bg-content1 py-1 shadow-xl"
          onScroll={handleScroll}
        >
          {users.map((user) => (
            <li key={user.id}>
              <button
                aria-label={`Message ${user.username}`}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-default-100"
                type="button"
                // Keep focus so the dropdown doesn't blur-close before onClick.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onStartConversation(user);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Avatar
                  className="bg-brand/10 text-brand flex-shrink-0 ring-1 ring-brand/20"
                  name={user.username.charAt(0).toUpperCase()}
                  size="md"
                  src={user.avatarUrl ?? undefined}
                />
                <p className="min-w-0 flex-grow truncate text-sm font-medium text-foreground">
                  {user.username}
                </p>
                <span className="bg-brand/15 text-brand flex-shrink-0 rounded-full p-2">
                  <Icon name="chat-bubble" size={16} />
                </span>
              </button>
            </li>
          ))}

          {loading && (
            <li className="px-3 py-2 text-center text-tiny text-default-400">
              Searching…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
