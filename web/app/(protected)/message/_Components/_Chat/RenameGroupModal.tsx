"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import type { ChatMutationResult } from "../ChatProvider";

const MAX_NAME_LENGTH = 100;

interface RenameGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The group's current name; null/empty for an unnamed group. */
  currentName: string | null;
  onSave: (name: string) => Promise<ChatMutationResult>;
}

export function RenameGroupModal({
  isOpen,
  onClose,
  currentName,
  onSave,
}: RenameGroupModalProps) {
  const [name, setName] = useState(currentName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start each opening from the group's current name.
  useEffect(() => {
    if (isOpen) setName(currentName ?? "");
  }, [isOpen, currentName]);

  const unchanged = name.trim() === (currentName ?? "");

  function handleClose() {
    setError(null);
    setSaving(false);
    onClose();
  }

  async function handleSave() {
    if (unchanged) return;
    setSaving(true);
    setError(null);

    const result = await onSave(name);

    if (!result.ok) {
      setError(result.detail);
      setSaving(false);

      return;
    }
    handleClose();
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
            Rename group
          </h2>
        </ModalHeader>
        <ModalBody className="gap-3 px-7 pt-5">
          <Input
            autoFocus
            classNames={{
              label: "!text-sm !font-semibold !text-foreground",
              inputWrapper: "h-11 border-[#46424d] bg-[#18191d]",
            }}
            label="Group name"
            labelPlacement="outside"
            maxLength={MAX_NAME_LENGTH}
            placeholder="e.g. The late-night crew"
            value={name}
            variant="bordered"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
            onValueChange={setName}
          />
          <p className="text-tiny text-default-400">
            Leave it empty to show the members&apos; names instead.
          </p>
          {error && <p className="text-small text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter className="mx-7 mb-2 mt-2 border-t border-white/10 px-0 pt-4">
          <div className="grid w-full grid-cols-[1fr_1.4fr] gap-2.5">
            <Button
              className="min-h-11 rounded-[10px] border border-[#4b4652] bg-[#34343b] text-sm font-bold shadow-[0_3px_0_#1a191f]"
              variant="flat"
              onPress={handleClose}
            >
              Cancel
            </Button>
            <Button
              className="btn-coral min-h-11 rounded-[10px] text-sm font-bold"
              isDisabled={unchanged}
              isLoading={saving}
              onPress={handleSave}
            >
              Save
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
