"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { addToast } from "@heroui/toast";

import { Icon } from "@/components/icon";
import { MOCK_FRIEND_IDS, MOCK_PHONE_USERS, MOCK_USERS } from "@/lib/mock-data";
import { Presence } from "@/types";

interface ChatHeaderProps {
  activeRecipient: string | null;
  draftRecipient: string;
  recipients: string[];
  displayName: (phoneNumber: string) => string;
  hasContact: (phoneNumber: string) => boolean;
  onDraftRecipientChange: (value: string) => void;
  onSelectRecipient: (recipient: string) => void;
  onEditContact: (recipient: string) => void;
  onStartCall: (recipient: string) => void;
}

const MAX_RESULTS = 10;

// A phone user is someone you text by number (always shown with the phone
// icon); an app user has a profile (shown with their avatar image + presence).
interface SearchUser {
  id: string;
  name: string;
  type: "phone" | "app";
  isFriend: boolean;
  presence?: Presence;
}

const PRESENCE_DOT: Record<Presence, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-400",
  offline: "bg-default-400",
};

function UserAvatar({ user }: { user: SearchUser }) {
  return (
    <div className="relative flex-shrink-0">
      <Avatar
        className="bg-brand/10 text-brand ring-1 ring-brand/20"
        size="md"
        {...(user.type === "phone"
          ? { icon: <Icon name="phone" size={18} /> }
          : { name: user.name.charAt(0).toUpperCase() })}
      />
      {user.type === "app" && user.presence && (
        <span
          className={`absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-content1 ${PRESENCE_DOT[user.presence]}`}
        />
      )}
    </div>
  );
}

export function ChatHeader({
  activeRecipient,
  draftRecipient,
  recipients,
  displayName,
  hasContact,
  onDraftRecipientChange,
  onSelectRecipient,
  onEditContact,
  onStartCall,
}: ChatHeaderProps) {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const headerName = activeRecipient ? displayName(activeRecipient) : "";
  const headerHasContact =
    activeRecipient !== null && hasContact(activeRecipient);

  // Your real contacts (phone users, all friends) + mocked phone contacts +
  // the mock app directory. Phone users are keyed/shown by their number.
  const phoneIds = new Set(recipients);
  const phoneFriends: SearchUser[] = [
    ...recipients.map((r) => ({
      id: r,
      name: displayName(r),
      type: "phone" as const,
      isFriend: true,
    })),
    ...MOCK_PHONE_USERS.filter((u) => !phoneIds.has(u.phoneNumber)).map((u) => ({
      id: u.phoneNumber,
      name: u.phoneNumber,
      type: "phone" as const,
      isFriend: true,
    })),
  ];
  const appUsers: SearchUser[] = MOCK_USERS.filter(
    (u) => !phoneIds.has(u.id),
  ).map((u) => ({
    id: u.id,
    name: u.name,
    type: "app",
    isFriend: MOCK_FRIEND_IDS.has(u.id),
    presence: u.presence,
  }));

  // A purely numeric query (digits / phone punctuation) is a phone-number
  // lookup: match phone users only and show bare numbers — no names, no status.
  // As soon as a letter is typed it's a name search: everyone, with names,
  // avatars and presence, friends first.
  const trimmed = draftRecipient.trim();
  const query = trimmed.toLowerCase();
  const isPhoneQuery = /\d/.test(trimmed) && /^[+\d\s()-]+$/.test(trimmed);
  const queryDigits = trimmed.replace(/\D/g, "");

  const matches = isPhoneQuery
    ? phoneFriends
        .filter((u) => u.id.replace(/\D/g, "").includes(queryDigits))
        .slice(0, MAX_RESULTS)
    : [...phoneFriends, ...appUsers]
        .filter(
          (u) =>
            !query ||
            u.name.toLowerCase().includes(query) ||
            u.id.toLowerCase().includes(query),
        )
        .sort((a, b) => Number(b.isFriend) - Number(a.isFriend))
        .slice(0, MAX_RESULTS);

  function sendRequest(user: SearchUser) {
    setRequested((prev) => new Set(prev).add(user.id));
    addToast({
      title: "Request sent",
      description: `Friend request sent to ${user.name}`,
    });
  }

  if (activeRecipient) {
    return (
      <div className="flex-shrink-0 flex items-center gap-2 px-4 h-14 border-b border-divider shadow-sm">
        <Avatar
          className="bg-brand/10 text-brand flex-shrink-0 ring-1 ring-brand/20"
          icon={<Icon name="phone" size={16} />}
          size="sm"
        />
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="font-semibold truncate text-foreground">
            {headerName}
          </h2>
          {headerHasContact && (
            <span className="text-tiny text-default-400 truncate">
              {activeRecipient}
            </span>
          )}
        </div>
        <div className="flex-grow" />
        <Button
          isIconOnly
          aria-label={
            headerHasContact
              ? `Edit contact ${headerName}`
              : `Add ${activeRecipient} to contacts`
          }
          className="text-default-400 hover:text-foreground"
          size="sm"
          variant="light"
          onPress={() => onEditContact(activeRecipient)}
        >
          <Icon name="edit" size={18} />
        </Button>
        <Button
          aria-label={`Call ${headerName}`}
          className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
          isIconOnly
          radius="full"
          size="sm"
          onPress={() => onStartCall(activeRecipient)}
        >
          <Icon name="phone" size={16} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 flex items-center px-4 py-4 border-b border-divider shadow-sm">
      <div className="relative w-full">
        {/* search bar — full width, like the message composer */}
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
            placeholder="Search users or enter a phone number"
            startContent={
              <Icon className="text-default-400 flex-shrink-0" name="search" size={18} />
            }
            value={draftRecipient}
            variant="flat"
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onFocusCapture={() => setOpen(true)}
            onValueChange={(v) => {
              onDraftRecipientChange(v);
              setOpen(true);
            }}
          />
        </div>

        {open && matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-medium border border-divider bg-content1 py-1 shadow-xl">
            {matches.map((user) =>
              isPhoneQuery ? (
                <li key={user.id}>
                  <button
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-default-100"
                    type="button"
                    onMouseDown={() => {
                      onSelectRecipient(user.id);
                      setOpen(false);
                    }}
                  >
                    <Avatar
                      className="bg-brand/10 text-brand flex-shrink-0 ring-1 ring-brand/20"
                      icon={<Icon name="phone" size={18} />}
                      size="md"
                    />
                    <p className="truncate text-sm font-medium text-foreground tabular-nums">
                      {user.id}
                    </p>
                  </button>
                </li>
              ) : user.isFriend ? (
                <li key={user.id}>
                  <button
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-default-100"
                    type="button"
                    onMouseDown={() => {
                      onSelectRecipient(user.id);
                      setOpen(false);
                    }}
                  >
                    <UserAvatar user={user} />
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {user.name}
                        </p>
                        <span className="flex-shrink-0 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                          Friend
                        </span>
                      </div>
                      {user.name !== user.id && (
                        <p className="truncate text-tiny text-default-400">
                          {user.id}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ) : (
                <li
                  key={user.id}
                  className="flex w-full items-center gap-3 px-3 py-2 hover:bg-default-100"
                >
                  <UserAvatar user={user} />
                  <div className="min-w-0 flex-grow">
                    <p className="truncate text-sm font-medium text-foreground">
                      {user.name}
                    </p>
                    <p className="truncate text-tiny text-default-400">
                      {user.id}
                    </p>
                  </div>
                  <Button
                    isIconOnly
                    aria-label={
                      requested.has(user.id)
                        ? "Friend request sent"
                        : `Add ${user.name} as a friend`
                    }
                    className={
                      requested.has(user.id)
                        ? "bg-emerald-500/20 text-emerald-500"
                        : "bg-brand/15 text-brand"
                    }
                    isDisabled={requested.has(user.id)}
                    radius="full"
                    size="sm"
                    // Keep focus on the search input so the results dropdown
                    // stays open — sending an invite just marks the user.
                    onMouseDown={(e) => e.preventDefault()}
                    onPress={() => sendRequest(user)}
                  >
                    <Icon
                      name={requested.has(user.id) ? "check" : "plus"}
                      size={16}
                    />
                  </Button>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
