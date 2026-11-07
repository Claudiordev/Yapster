"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Switch } from "@heroui/switch";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

interface EventsFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  openSpotsOnly: boolean;
  onApply: (filters: { openSpotsOnly: boolean }) => void;
}

/** The Filters button's modal; edits a draft that only applies on "Apply". */
export function EventsFiltersModal({
  isOpen,
  onClose,
  openSpotsOnly,
  onApply,
}: EventsFiltersModalProps) {
  const [draftOpenSpots, setDraftOpenSpots] = useState(openSpotsOnly);

  // Start each opening from what is currently applied.
  useEffect(() => {
    if (isOpen) setDraftOpenSpots(openSpotsOnly);
  }, [isOpen, openSpotsOnly]);

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
        <ModalHeader className="flex-col items-center gap-0 px-7 pt-7 pb-0 text-center">
          <h2 className="text-[25px] font-bold tracking-tight text-foreground">
            Filters
          </h2>
        </ModalHeader>
        <ModalBody className="gap-3 px-7 pt-5">
          <Switch
            classNames={{
              base: "m-0 w-full max-w-full flex-row-reverse justify-between rounded-medium border border-[#46424d] bg-[#18191d] px-4 py-3",
              wrapper: "mr-0",
            }}
            isSelected={draftOpenSpots}
            size="sm"
            onValueChange={setDraftOpenSpots}
          >
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                Open spots only
              </span>
              <span className="text-tiny text-default-400">
                Hide events that are already full.
              </span>
            </div>
          </Switch>
        </ModalBody>
        <ModalFooter className="mx-7 mb-2 mt-2 border-t border-white/10 px-0 pt-4">
          <div className="grid w-full grid-cols-[1fr_1.4fr] gap-2.5">
            <Button
              className="min-h-11 rounded-[10px] border border-[#4b4652] bg-[#34343b] text-sm font-bold shadow-[0_3px_0_#1a191f]"
              variant="flat"
              onPress={() => setDraftOpenSpots(false)}
            >
              Reset
            </Button>
            <Button
              className="btn-coral min-h-11 rounded-[10px] text-sm font-bold"
              onPress={() => {
                onApply({ openSpotsOnly: draftOpenSpots });
                onClose();
              }}
            >
              Apply
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
