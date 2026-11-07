"use client";

import { useEffect } from "react";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import { Icon } from "@/components/Icon/Icon";
import { RoomCode } from "./RoomCode";
import { useRoomVerification } from "../../_Actions/useRoomVerification";

interface RoomCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventName: string;
  roomCode: string;
  /** The player is verified in the room: register them for the event. */
  onVerified: () => void;
}

/** "Join tournament" for events with a room code: shows the code and waits until the player is in the room. */
export function RoomCodeModal({
  isOpen,
  onClose,
  eventName,
  roomCode,
  onVerified,
}: RoomCodeModalProps) {
  const status = useRoomVerification(isOpen, onVerified);
  const verified = status === "verified";

  // Close shortly after the check passes, so "You're in!" is seen.
  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(onClose, 1500);

    return () => clearTimeout(timer);
  }, [verified, onClose]);

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
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-1 px-7 pt-7 pb-0 pr-14">
          <h2 className="text-[25px] font-bold leading-tight tracking-tight text-foreground">
            Join the room.
          </h2>
          <p className="text-small font-normal text-default-500">
            Enter this code in the game to take your seat in {eventName}.
          </p>
        </ModalHeader>
        <ModalBody className="gap-4 px-7 pt-5">
          <RoomCode code={roomCode} />

          <p className="text-tiny text-default-400">
            Open the game, then Online, then Enter Code.
          </p>

          <div className="flex items-center gap-3 rounded-medium border border-divider bg-black/20 px-4 py-3">
            {verified ? (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
                <Icon name="check" size={12} />
              </span>
            ) : (
              <Spinner color="default" size="sm" />
            )}
            <span className="text-sm font-semibold text-foreground">
              {verified ? "You're in!" : "Waiting for you to join the room…"}
            </span>
          </div>
          <p className="text-tiny text-default-400">
            Your spot only counts once you&apos;re in the room.
          </p>
        </ModalBody>
        <ModalFooter className="mx-7 mb-2 mt-2 border-t border-white/10 px-0 pt-4">
          <Button
            className="min-h-11 w-full rounded-[10px] border border-[#4b4652] bg-[#34343b] text-sm font-bold shadow-[0_3px_0_#1a191f]"
            variant="flat"
            onPress={onClose}
          >
            {verified ? "Done" : "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
