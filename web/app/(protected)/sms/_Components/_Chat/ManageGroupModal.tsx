"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { addToast } from "@heroui/toast";

import { Icon } from "@/components/icon";
import type { Conversation } from "@/lib/chat";

interface Member {
  id: string;
  username: string | null;
  avatarUrl: string | null;
}

interface ManageGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  myUserId: string;
  myUsername: string | null;
  onRemoveMember: (userId: string) => Promise<boolean>;
  onDeleteGroup: () => Promise<boolean>;
}

export function ManageGroupModal({
  isOpen,
  onClose,
  conversation,
  myUserId,
  myUsername,
  onRemoveMember,
  onDeleteGroup,
}: ManageGroupModalProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const roster: Member[] = [
    { id: myUserId, username: myUsername ?? "You", avatarUrl: null },
    ...conversation.members,
  ];

  function handleClose() {
    setConfirmingDelete(false);
    onClose();
  }

  async function handleRemove(member: Member) {
    setRemovingId(member.id);
    const ok = await onRemoveMember(member.id);

    setRemovingId(null);
    if (!ok) addToast({ title: "Could not remove member", color: "danger" });
  }

  async function handleDelete() {
    setDeleting(true);
    const ok = await onDeleteGroup();

    if (!ok) {
      setDeleting(false);
      addToast({ title: "Could not delete group", color: "danger" });

      return;
    }
    // onDeleteGroup already navigates away on success.
  }

  return (
    <Modal backdrop="blur" isOpen={isOpen} size="md" onClose={handleClose}>
      <ModalContent>
        <ModalHeader>Manage group</ModalHeader>
        <ModalBody className="gap-4 pb-6">
          <div className="flex flex-col gap-1">
            {roster.map((member) => {
              const isCreator = member.id === conversation.creatorId;
              const isMe = member.id === myUserId;

              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-medium px-2 py-2"
                >
                  <Avatar
                    className="bg-brand/10 text-brand flex-shrink-0 ring-1 ring-brand/20"
                    name={(member.username ?? "?").charAt(0).toUpperCase()}
                    size="sm"
                    src={member.avatarUrl ?? undefined}
                  />
                  <p className="min-w-0 flex-grow truncate text-sm font-medium text-foreground">
                    {member.username ?? "Unknown"}
                    {isMe && " (you)"}
                  </p>
                  {isCreator && (
                    <Chip color="warning" size="sm" variant="flat">
                      Creator
                    </Chip>
                  )}
                  {!isCreator && (
                    <Button
                      isIconOnly
                      isLoading={removingId === member.id}
                      size="sm"
                      variant="light"
                      onPress={() => handleRemove(member)}
                    >
                      <Icon className="text-danger" name="close" size={16} />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="h-px bg-divider" />

          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <p className="flex-grow text-small text-danger">
                Delete this group for everyone? This can't be undone.
              </p>
              <Button
                size="sm"
                variant="flat"
                onPress={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-danger text-white"
                isLoading={deleting}
                size="sm"
                onPress={handleDelete}
              >
                Delete
              </Button>
            </div>
          ) : (
            <Button
              className="w-fit"
              color="danger"
              size="sm"
              variant="light"
              onPress={() => setConfirmingDelete(true)}
            >
              Delete group
            </Button>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
