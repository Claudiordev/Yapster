"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";

import { useUserSearch } from "@/app/(protected)/message/_Actions/useUserSearch";

import { Icon } from "@/components/Icon/Icon";
import type { PlatformUser } from "@/types/user";
import type { ChatMutationResult } from "../ChatProvider";

const MAX_MEMBERS = 15;

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ids already in the group (creator + current members) — filtered out of results. */
  existingMemberIds: string[];
  onAdd: (user: PlatformUser) => Promise<ChatMutationResult>;
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
    const result = await onAdd(user);

    setAddingId(null);
    if (!result.ok) {
      addToast({ title: result.detail, color: "danger" });
    } else {
      handleClose();
    }
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{
        backdrop: "bg-black/70 backdrop-blur-2xl backdrop-saturate-50",
        base: "start-card",
        closeButton: "right-4 top-4 rounded-full border border-white/15",
      }}
      isOpen={isOpen}
      size="md"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex-col items-center gap-0 px-7 pt-7 pb-0 text-center">
          <h2 className="text-[25px] font-bold tracking-tight text-foreground">
            Add a member
          </h2>
        </ModalHeader>
        <ModalBody className="gap-4 px-7 pt-4">
          {full ? (
            <p className="text-small text-default-400">
              This group already has the maximum of {MAX_MEMBERS} members.
            </p>
          ) : (
            <>
              <Input
                aria-label="Search users to add"
                classNames={{
                  inputWrapper: "h-11 border border-[#424147] bg-[#18191d]",
                }}
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

              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
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
                      className="text-brand flex-shrink-0"
                      name="plus"
                      size={16}
                    />
                  </button>
                ))}
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter className="mx-7 mb-2 flex-col items-stretch gap-4 border-t border-white/10 px-0 pt-4">
          <p className="text-tiny leading-relaxed text-default-400">
            Pick someone to add to this group.
            <span className="ml-2 text-default-500">
              {existingMemberIds.length}/{MAX_MEMBERS} members
            </span>
          </p>
          <Button
            className="min-h-11 rounded-[10px] border border-[#4b4652] bg-[#34343b] text-sm font-bold shadow-[0_3px_0_#1a191f]"
            variant="flat"
            onPress={handleClose}
          >
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
