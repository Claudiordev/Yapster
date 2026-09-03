"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import { useUserSearch } from "./useUserSearch";

import { Icon } from "@/components/icon";
import type { PlatformUser } from "@/app/api/users/search/route";
import type { ChatMutationResult } from "../ChatProvider";

/** Creator + this many others — mirrors the chat service's MAX_GROUP_SIZE. */
const MAX_OTHER_MEMBERS = 14;

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    members: PlatformUser[],
  ) => Promise<ChatMutationResult>;
}

export function NewGroupModal({
  isOpen,
  onClose,
  onCreate,
}: NewGroupModalProps) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlatformUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { users, loading } = useUserSearch(query);

  const atLimit = selected.length >= MAX_OTHER_MEMBERS;

  function reset() {
    setName("");
    setQuery("");
    setSelected([]);
    setError(null);
    setCreating(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggle(user: PlatformUser) {
    setSelected((prev) => {
      if (prev.some((u) => u.id === user.id)) {
        return prev.filter((u) => u.id !== user.id);
      }
      if (prev.length >= MAX_OTHER_MEMBERS) return prev;

      return [...prev, user];
    });
  }

  async function handleCreate() {
    if (!name.trim() || selected.length === 0) return;
    setCreating(true);
    setError(null);

    const result = await onCreate(name.trim(), selected);

    if (!result.ok) {
      setError(result.detail);
      setCreating(false);

      return;
    }

    handleClose();
  }

  return (
    <Modal backdrop="blur" isOpen={isOpen} size="md" onClose={handleClose}>
      <ModalContent>
        <ModalHeader>New group</ModalHeader>
        <ModalBody className="gap-4">
          <Input
            label="Group name"
            labelPlacement="outside"
            placeholder="What's this group called?"
            value={name}
            variant="bordered"
            onValueChange={setName}
          />

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((user) => (
                <Chip
                  key={user.id}
                  avatar={
                    <Avatar
                      name={user.username.charAt(0).toUpperCase()}
                      src={user.avatarUrl ?? undefined}
                    />
                  }
                  variant="flat"
                  onClose={() => toggle(user)}
                >
                  {user.username}
                </Chip>
              ))}
            </div>
          )}

          <Input
            aria-label="Search users to add"
            isDisabled={atLimit}
            placeholder={
              atLimit
                ? `Max ${MAX_OTHER_MEMBERS} members reached`
                : "Search users to add"
            }
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
            {users.map((user) => {
              const isSelected = selected.some((u) => u.id === user.id);

              return (
                <button
                  key={user.id}
                  className={`flex w-full items-center gap-3 rounded-medium px-3 py-2 text-left transition-colors ${
                    isSelected ? "bg-brand/10" : "hover:bg-default-100"
                  }`}
                  disabled={!isSelected && atLimit}
                  type="button"
                  onClick={() => toggle(user)}
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
                  {isSelected && (
                    <Icon
                      className="text-brand flex-shrink-0"
                      name="check"
                      size={16}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {error && <p className="text-small text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <span className="mr-auto self-center text-tiny text-default-400">
            {selected.length}/{MAX_OTHER_MEMBERS} members
          </span>
          <Button variant="flat" onPress={handleClose}>
            Cancel
          </Button>
          <Button
            className="bg-brand text-white hover:bg-brand-hover"
            isDisabled={!name.trim() || selected.length === 0}
            isLoading={creating}
            onPress={handleCreate}
          >
            Create group
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
