"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { addToast } from "@heroui/toast";

import { useUserSearch } from "./useUserSearch";

import { Icon } from "@/components/icon";
import type { PlatformUser } from "@/app/api/users/search/route";

const MAX_MEMBERS = 15;

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ids already in the group (creator + current members) — filtered out of results. */
  existingMemberIds: string[];
  onAdd: (user: PlatformUser) => Promise<boolean>;
}

export function AddMemberModal({
  isOpen,
  onClose,
  existingMemberIds,
  onAdd,
}: AddMemberModalProps) {
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const { users, loading } = useUserSearch(query);

  const full = existingMemberIds.length >= MAX_MEMBERS;
  const results = users.filter((u) => !existingMemberIds.includes(u.id));

  function handleClose() {
    setQuery("");
    onClose();
  }

  async function handleAdd(user: PlatformUser) {
    setAddingId(user.id);
    const ok = await onAdd(user);

    setAddingId(null);
    if (!ok) {
      addToast({ title: "Could not add member", color: "danger" });
    } else {
      handleClose();
    }
  }

  return (
    <Modal backdrop="blur" isOpen={isOpen} size="md" onClose={handleClose}>
      <ModalContent>
        <ModalHeader>Add member</ModalHeader>
        <ModalBody className="gap-3 pb-6">
          {full ? (
            <p className="text-small text-default-400">
              This group already has the maximum of {MAX_MEMBERS} members.
            </p>
          ) : (
            <>
              <Input
                aria-label="Search users to add"
                placeholder="Search users to add"
                startContent={
                  <Icon
                    className="text-default-400 flex-shrink-0"
                    name="search"
                    size={18}
                  />
                }
                value={query}
                variant="flat"
                onValueChange={setQuery}
              />

              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {loading && (
                  <p className="py-2 text-center text-tiny text-default-400">
                    Searching…
                  </p>
                )}
                {results.map((user) => (
                  <button
                    key={user.id}
                    className="flex w-full items-center gap-3 rounded-medium px-3 py-2 text-left transition-colors hover:bg-default-100 disabled:opacity-50"
                    disabled={addingId === user.id}
                    type="button"
                    onClick={() => handleAdd(user)}
                  >
                    <Avatar
                      className="bg-brand/10 text-brand flex-shrink-0 ring-1 ring-brand/20"
                      name={user.username.charAt(0).toUpperCase()}
                      size="sm"
                      src={user.avatarUrl ?? undefined}
                    />
                    <p className="min-w-0 flex-grow truncate text-sm font-medium text-foreground">
                      {user.username}
                    </p>
                    <Icon
                      className="text-default-400 flex-shrink-0"
                      name="plus"
                      size={16}
                    />
                  </button>
                ))}
              </div>
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
