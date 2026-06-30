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

interface ContactModalProps {
  isOpen: boolean;
  phoneNumber: string;
  currentName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function ContactModal({
  isOpen,
  phoneNumber,
  currentName,
  onClose,
  onSave,
}: ContactModalProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (isOpen) setName(currentName);
  }, [isOpen, currentName]);

  const isEditing = currentName.length > 0;
  const trimmed = name.trim();

  function handleSave() {
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  }

  function handleRemove() {
    onSave("");
    onClose();
  }

  return (
    <Modal isOpen={isOpen} placement="center" size="sm" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span>{isEditing ? "Edit contact" : "Add to contacts"}</span>
          <span className="text-small font-normal text-default-500">
            {phoneNumber}
          </span>
        </ModalHeader>
        <ModalBody>
          <Input
            autoFocus
            isRequired
            label="Name"
            placeholder="e.g. Alice"
            value={name}
            variant="bordered"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            onValueChange={setName}
          />
        </ModalBody>
        <ModalFooter className="flex justify-between">
          {isEditing ? (
            <Button color="danger" variant="light" onPress={handleRemove}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={!trimmed}
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
