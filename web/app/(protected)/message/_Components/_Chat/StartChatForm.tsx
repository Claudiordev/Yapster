"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

import { useUserSearch } from "@/app/(protected)/message/_Actions/useUserSearch";

import { Icon } from "@/components/Icon/Icon";
import type { PlatformUser } from "@/types/user";
import type { ChatMutationResult } from "../ChatProvider";

/** Creator + this many others — mirrors the chat service's MAX_GROUP_SIZE. */
const MAX_OTHER_MEMBERS = 14;

interface StartChatFormProps {
  onStartConversation: (user: PlatformUser) => Promise<void>;
  onCreateGroup: (
    name: string | null,
    members: PlatformUser[],
  ) => Promise<ChatMutationResult>;
}

/**
 * Pick one friend (opens a DM) or several (creates a group). Owns the search
 * query and the selection; groups are created unnamed and shown as their members.
 */
export function StartChatForm({
  onStartConversation,
  onCreateGroup,
}: StartChatFormProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlatformUser[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { users, loading, hasMore, loadMore } = useUserSearch(query);

  const searching = query.trim().length > 0;
  const atLimit = selected.length >= MAX_OTHER_MEMBERS;
  const isGroup = selected.length > 1;

  function toggle(user: PlatformUser) {
    setError(null);
    setSelected((prev) => {
      if (prev.some((u) => u.id === user.id)) {
        return prev.filter((u) => u.id !== user.id);
      }
      if (prev.length >= MAX_OTHER_MEMBERS) return prev;

      return [...prev, user];
    });
  }

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

  async function handleStart() {
    if (selected.length === 0) return;
    setStarting(true);
    setError(null);

    if (!isGroup) {
      await onStartConversation(selected[0]);
      setStarting(false);
      setSelected([]);
      setQuery("");

      return;
    }

    const result = await onCreateGroup(null, selected);

    setStarting(false);
    if (!result.ok) {
      setError(result.detail);

      return;
    }
    setSelected([]);
    setQuery("");
  }

  return (
    <div className="w-full text-left">
      <div className="overflow-hidden rounded-[11px] border border-[#424147] bg-[#18191d] focus-within:border-brand">
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-[#424147] p-2.5">
            {selected.map((user) => (
              <span
                key={user.id}
                className="flex items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-2.5 ring-1 ring-white/10"
              >
                <Avatar
                  className="h-6 w-6 flex-shrink-0 bg-brand/10 text-brand"
                  name={user.username.charAt(0).toUpperCase()}
                  size="sm"
                  src={user.avatarUrl ?? undefined}
                />
                <span className="max-w-[140px] truncate text-sm font-semibold text-foreground">
                  {user.username}
                </span>
                <button
                  aria-label={`Remove ${user.username}`}
                  className="text-default-400 hover:text-foreground"
                  type="button"
                  onClick={() => toggle(user)}
                >
                  <Icon name="close" size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        <Input
          aria-label="Search friends to add"
          autoComplete="off"
          classNames={{
            inputWrapper:
              "min-h-12 rounded-none bg-transparent shadow-none data-[hover=true]:bg-transparent group-data-[focus=true]:bg-transparent",
            input: "text-sm",
          }}
          data-1p-ignore="true"
          data-lpignore="true"
          isDisabled={atLimit}
          placeholder={
            atLimit
              ? `Max ${MAX_OTHER_MEMBERS} people reached`
              : "Search friends to add..."
          }
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
      </div>

      {searching && (
        <ul
          className="mt-2 max-h-52 overflow-y-auto rounded-[11px] border border-[#424147] bg-[#18191d] p-1"
          onScroll={handleScroll}
        >
          {users.map((user) => {
            const isSelected = selected.some((u) => u.id === user.id);

            return (
              <li key={user.id}>
                <button
                  aria-pressed={isSelected}
                  className={`flex min-h-[48px] w-full items-center gap-3 rounded-[8px] px-2 py-1.5 text-left ${
                    isSelected ? "bg-brand/10" : "hover:bg-white/5"
                  }`}
                  disabled={!isSelected && atLimit}
                  type="button"
                  onClick={() => toggle(user)}
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
                  {isSelected && (
                    <Icon
                      className="flex-shrink-0 text-brand"
                      name="check"
                      size={16}
                    />
                  )}
                </button>
              </li>
            );
          })}
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
      )}

      {error && <p className="mt-3 text-small text-danger">{error}</p>}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-default-500">
          {selected.length === 0
            ? "No one selected"
            : `${selected.length} ${selected.length === 1 ? "person" : "people"} selected · ${
                isGroup ? "Group chat" : "Direct message"
              }`}
        </p>
        <Button
          className="login-sign-in flex-shrink-0 px-6 text-sm"
          endContent={<Icon name="arrow-right" size={16} />}
          isDisabled={selected.length === 0}
          isLoading={starting}
          onPress={handleStart}
        >
          Start chat
        </Button>
      </div>
    </div>
  );
}
