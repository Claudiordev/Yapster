"use client";

import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";

import { Icon } from "@/components/icon";

interface IncomingCallModalProps {
  isOpen: boolean;
  /** Conversation display name — who/what is calling. */
  title: string;
  /** Caller's avatar, when we can resolve them from the member list. */
  avatarUrl?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Blocking "someone started a call" prompt. Deliberately not dismissible by
 * backdrop/escape — the two buttons are the only way out, so a call is never
 * silently lost to a stray click.
 */
export function IncomingCallModal({
  isOpen,
  title,
  avatarUrl,
  onAccept,
  onDecline,
}: IncomingCallModalProps) {
  return (
    <Modal
      hideCloseButton
      backdrop="blur"
      isDismissable={false}
      isKeyboardDismissDisabled={true}
      isOpen={isOpen}
      size="sm"
      onClose={onDecline}
    >
      <ModalContent>
        <ModalBody className="items-center gap-4 py-8">
          <Avatar
            className="bg-brand text-white ring-4 ring-brand/20 animate-pulse"
            name={title.charAt(0).toUpperCase()}
            src={avatarUrl ?? undefined}
            style={{ width: 88, height: 88, fontSize: "2rem" }}
          />

          <div className="text-center">
            <p className="text-tiny font-medium uppercase tracking-widest text-default-500">
              Incoming call
            </p>
            <p className="text-lg font-semibold text-foreground">{title}</p>
          </div>

          <div className="mt-2 flex items-center gap-6">
            <div className="flex flex-col items-center gap-1.5">
              <Button
                isIconOnly
                aria-label="Decline call"
                className="h-14 w-14 min-w-14 bg-danger text-white shadow-lg shadow-danger/30"
                radius="full"
                onPress={onDecline}
              >
                <Icon className="rotate-[135deg]" name="phone" size={22} />
              </Button>
              <span className="text-tiny text-default-500">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <Button
                isIconOnly
                aria-label="Join call"
                className="h-14 w-14 min-w-14 bg-success text-white shadow-lg shadow-success/30"
                radius="full"
                onPress={onAccept}
              >
                <Icon name="phone" size={22} />
              </Button>
              <span className="text-tiny text-default-500">Join</span>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
