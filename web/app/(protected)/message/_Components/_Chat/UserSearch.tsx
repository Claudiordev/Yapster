"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Input } from "@heroui/input";

import { useUserSearch } from "@/app/(protected)/message/_Actions/useUserSearch";

import { Icon } from "@/components/Icon/Icon";
import type { PlatformUser } from "@/types/user";

interface UserSearchProps {
  onStartConversation: (user: PlatformUser) => void;
}

/** Search users by name and start a DM with one. Owns its own query state. */
export function UserSearch({ onStartConversation }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const { users, loading, hasMore, loadMore } = useUserSearch(query);
  const searching = query.trim().length > 0;

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
    <div className="w-full text-left">
      <Input
        aria-label="Search users"
        autoComplete="off"
        classNames={{
          inputWrapper:
            "min-h-11 rounded-[11px] border border-[#424147] bg-[#18191d] shadow-none data-[hover=true]:bg-[#18191d] group-data-[focus=true]:bg-[#18191d] group-data-[focus=true]:border-brand",
          input: "text-sm",
        }}
        data-1p-ignore="true"
        data-lpignore="true"
        placeholder="Search for a friend"
        startContent={
          <Icon
            className="text-default-400 flex-shrink-0"
            name="search"
            size={17}
          />
        }
        value={query}
        variant="flat"
        onValueChange={setQuery}
      />

      {searching ? (
        <>
          <div className="mt-4 mb-2 flex justify-between px-1 text-[10px] tracking-[0.1em] text-default-400">
            <span>SEARCH RESULTS</span>
            {!loading && <span>{users.length}</span>}
          </div>
          <ul className="max-h-60 overflow-y-auto" onScroll={handleScroll}>
            {users.map((user) => (
              <li key={user.id}>
                <button
                  aria-label={`Message ${user.username}`}
                  className="flex min-h-[55px] w-full items-center gap-3 rounded-[10px] px-1.5 py-2 text-left hover:bg-white/5"
                  type="button"
                  onClick={() => {
                    onStartConversation(user);
                    setQuery("");
                  }}
                >
                  <Avatar
                    className="flex-shrink-0 bg-brand/10 text-brand ring-1 ring-brand/20"
                    name={user.username.charAt(0).toUpperCase()}
                    size="sm"
                    src={user.avatarUrl ?? undefined}
                  />
                  <p className="min-w-0 flex-grow truncate text-sm font-semibold text-foreground">
                    {user.username}
                  </p>
                  <Icon
                    className="flex-shrink-0 text-brand/80"
                    name="chat-bubble"
                    size={16}
                  />
                </button>
              </li>
            ))}
            {loading && (
              <li className="py-2 text-center text-tiny text-default-400">
                Searching…
              </li>
            )}
            {!loading && users.length === 0 && (
              <li className="py-4 text-center text-small text-default-400">
                No one found.
              </li>
            )}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-center text-xs text-default-400">
          Search by username to say hello.
        </p>
      )}
    </div>
  );
}
