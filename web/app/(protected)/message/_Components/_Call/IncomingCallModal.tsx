"use client";

import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";

import { Icon } from "@/components/Icon/Icon";

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
 * "Someone started a call" prompt. Not dismissible by clicking the backdrop (a
 * stray click shouldn't lose a call), but Esc dismisses it, same as Decline.
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
      classNames={{ base: "incoming-call-card" }}
      isDismissable={false}
      isOpen={isOpen}
      size="sm"
      onClose={onDecline}
    >
      <ModalContent>
        <ModalBody className="items-center gap-0 px-8 pb-6 pt-7">
          <div className="incoming-call-avatar">
            <span aria-hidden className="incoming-call-ring incoming-call-ring--outer" />
            <span aria-hidden className="incoming-call-ring incoming-call-ring--inner" />
            <Avatar
              className="incoming-call-avatar-face"
              name={title.charAt(0).toUpperCase()}
              src={avatarUrl ?? undefined}
            />
            <span className="incoming-call-badge">
              <Icon name="phone" size={14} />
            </span>
          </div>

          <p className="mt-6 max-w-full truncate text-[26px] font-extrabold tracking-tight text-white">
            {title}
          </p>
          <p className="mt-1 text-small text-default-400">is calling you</p>

          <div className="incoming-call-divider" />

          <div className="grid w-full grid-cols-2 gap-3">
            <Button
              autoFocus
              className="incoming-call-btn incoming-call-btn--decline"
              radius="none"
              startContent={<Icon className="rotate-[135deg]" name="phone" size={16} />}
              variant="light"
              onPress={onDecline}
            >
              Decline
            </Button>
            <Button
              className="incoming-call-btn incoming-call-btn--accept"
              radius="none"
              startContent={<Icon name="phone" size={16} />}
              variant="light"
              onPress={onAccept}
            >
              Accept call
            </Button>
          </div>

          <p className="mt-4 text-tiny text-default-500">
            Press <kbd className="incoming-call-kbd">Esc</kbd> to dismiss
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
