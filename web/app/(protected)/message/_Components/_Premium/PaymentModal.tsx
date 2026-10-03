"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";

import { Icon } from "@/components/Icon/Icon";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  /** Total as displayed, in euros (e.g. "8.99"). */
  total: string;
  billing: "monthly" | "yearly";
}

/** Digits only, grouped 4-4-4-4 (up to 16 digits). */
function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** Digits only as MM / YY. */
function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  return digits.length > 2
    ? `${digits.slice(0, 2)} / ${digits.slice(2)}`
    : digits;
}

const FIELD_CLASSES = {
  label: "!text-small !text-default-500",
  inputWrapper: "h-11 border-white/10 bg-black/25",
  input: "text-small",
};

/** Payment preview: sample card details and a total; no payment is taken. */
export function PaymentModal({
  isOpen,
  onClose,
  planName,
  total,
  billing,
}: PaymentModalProps) {
  // Held only in this component's state; nothing is sent anywhere yet.
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [code, setCode] = useState("");
  const period = billing === "yearly" ? "Yearly" : "Monthly";

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: "rounded-[22px] border border-white/10 bg-gradient-to-br from-[#2d2d32] to-[#252629] shadow-[0_5px_0_#19191e,0_24px_85px_rgba(0,0,0,0.4)]",
        closeButton: "right-4 top-4 rounded-full border border-white/15",
      }}
      isOpen={isOpen}
      size="md"
      onClose={onClose}
    >
      <ModalContent>
        <ModalBody className="gap-0 p-7">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand">
            <Icon name="lock" size={12} />
            Checkout
          </p>
          <h2 className="mt-4 text-[28px] font-extrabold leading-tight text-white">
            Go a little further.
          </h2>
          <p className="mt-1 text-small text-default-400">
            A little upgrade, a lot more you
          </p>

          <div className="mt-6 flex items-center gap-4 rounded-large border border-brand/40 bg-black/20 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-small font-bold text-white">{planName}</p>
              <p className="text-tiny text-default-400">
                {period} subscription
              </p>
            </div>
            <div className="text-right">
              <p className="text-small font-bold text-white">€{total}</p>
              <p className="text-tiny text-default-400">
                per {billing === "yearly" ? "year" : "month"}
              </p>
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between">
            <p className="text-small font-bold text-white">Payment method</p>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-large border border-brand/60 bg-brand/10 px-4 py-3">
            <span className="flex items-center gap-2 text-small font-semibold text-white">
              <Icon className="text-brand" name="card" size={16} />
              Credit or debit card
            </span>
            <span className="text-small font-extrabold italic tracking-wider text-default-300">
              VISA
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <Input
              classNames={FIELD_CLASSES}
              autoComplete="cc-name"
              label="Cardholder name"
              labelPlacement="outside"
              placeholder="Name on card"
              value={name}
              onValueChange={setName}
              variant="bordered"
            />
            <Input
              classNames={FIELD_CLASSES}
              endContent={
                <Icon className="text-default-400" name="lock" size={12} />
              }
              autoComplete="cc-number"
              inputMode="numeric"
              label="Card number"
              labelPlacement="outside"
              placeholder="1234 5678 9012 3456"
              value={number}
              onValueChange={(v) => setNumber(formatCardNumber(v))}
              variant="bordered"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                classNames={FIELD_CLASSES}
                autoComplete="cc-exp"
                inputMode="numeric"
                label="Expiry date"
                labelPlacement="outside"
                placeholder="MM / YY"
                value={expiry}
                onValueChange={(v) => setExpiry(formatExpiry(v))}
                variant="bordered"
              />
              <Input
                classNames={FIELD_CLASSES}
                autoComplete="cc-csc"
                inputMode="numeric"
                label="Security code"
                labelPlacement="outside"
                maxLength={4}
                placeholder="CVC"
                type="password"
                value={code}
                onValueChange={(v) => setCode(v.replace(/\D/g, ""))}
                variant="bordered"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
            <span className="text-small text-white">
              Total today{" "}
              <span className="ml-1 text-tiny text-default-400">EUR</span>
            </span>
            <span className="text-[28px] font-extrabold text-white">
              €{total}
            </span>
          </div>

          <Button
            className="login-sign-in mt-5 w-full"
            radius="none"
            startContent={<Icon name="lock" size={14} />}
            variant="light"
            onPress={onClose}
          >
            Preview subscription · €{total}
          </Button>

        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
