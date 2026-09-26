"use client";

import { Modal, ModalBody, ModalContent } from "@heroui/modal";

import { SettingsPanel } from "@/app/(protected)/settings/_Components/SettingsPanel";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  return (
    <Modal
      backdrop="blur"
      isOpen={isOpen}
      scrollBehavior="inside"
      size="2xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalBody className="py-6">
          <SettingsPanel />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
