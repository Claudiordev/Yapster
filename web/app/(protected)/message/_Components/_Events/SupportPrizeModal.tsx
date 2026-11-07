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

import { Icon } from "@/components/Icon/Icon";
import { formatPrize } from "./utils/eventFilters";

const PRESETS = [5, 10, 25];
const DEFAULT_AMOUNT = 10;

interface SupportPrizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventName: string;
  prizePool: number;
  onContribute: (amount: number) => void;
}

/** "Support the prize pool": pick or type an amount. Demo only, no payment is collected. */
export function SupportPrizeModal({
  isOpen,
  onClose,
  eventName,
  prizePool,
  onContribute,
}: SupportPrizeModalProps) {
  const [value, setValue] = useState(String(DEFAULT_AMOUNT));

  // Start each opening from the default amount.
  useEffect(() => {
    if (isOpen) setValue(String(DEFAULT_AMOUNT));
  }, [isOpen]);

  const amount = Number(value);
  const valid = Number.isInteger(amount) && amount > 0;

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
            Make the prize a little bigger.
          </h2>
          <p className="text-small font-normal text-default-500">Support {eventName}.</p>
        </ModalHeader>
        <ModalBody className="gap-4 px-7 pt-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#f5b73b]">
            <Icon name="trophy" size={16} />
            Current prize pool: {formatPrize(prizePool)}
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            {PRESETS.map((preset) => {
              const selected = amount === preset;

              return (
                <Button
                  key={preset}
                  aria-pressed={selected}
                  className={`!h-11 w-full min-w-0 border-2 px-0 text-base font-bold ${
                    selected ? "btn-coral" : "chat-profile-action chat-profile-settings"
                  }`}
                  variant="light"
                  onPress={() => setValue(String(preset))}
                >
                  {formatPrize(preset)}
                </Button>
              );
            })}
          </div>

          <Input
            classNames={{
              label: "!text-sm !font-semibold !text-foreground",
              inputWrapper: "h-11 border-[#46424d] bg-[#18191d]",
            }}
            inputMode="numeric"
            label="Contribution in EUR"
            labelPlacement="outside"
            value={value}
            variant="bordered"
            onValueChange={(next) => setValue(next.replace(/\D/g, "").slice(0, 5))}
          />
        </ModalBody>
        <ModalFooter className="mx-7 mb-2 mt-2 flex-col gap-3 border-t border-white/10 px-0 pt-4">
          <Button
            className="btn-coral min-h-11 w-full rounded-[10px] text-sm font-bold"
            isDisabled={!valid}
            startContent={<Icon name="gift" size={16} />}
            onPress={() => {
              onContribute(amount);
              onClose();
            }}
          >
            Preview contribution
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
