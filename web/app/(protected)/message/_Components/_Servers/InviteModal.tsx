"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { addToast } from "@heroui/toast";

import { Icon } from "@/components/Icon/Icon";
import { POPUP_MOTION_PROPS } from "@/lib/popupMotion";
import type { CommunityServer } from "@/types/server";

interface InviteModalProps {
  isOpen: boolean;
  server: CommunityServer;
  onClose: () => void;
}

interface ActiveInvite {
  code: string;
  uses: string;
  expires: string;
}

const EXPIRY_OPTIONS = ["30 minutes", "1 hour", "1 day", "7 days", "Never"];
const USES_OPTIONS = ["No limit", "1 use", "5 uses", "10 uses", "25 uses"];

function newCode(server: CommunityServer): string {
  return `${server.short.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function InviteModal({ isOpen, server, onClose }: InviteModalProps) {
  const [code, setCode] = useState(() => newCode(server));
  const [expires, setExpires] = useState("7 days");
  const [maxUses, setMaxUses] = useState("No limit");
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState<ActiveInvite[]>([
    { code: `${server.short.toLowerCase()}-9fK2a`, uses: "6 / 10", expires: "in 2 days" },
    { code: `${server.short.toLowerCase()}-x71Qe`, uses: "1 / 1", expires: "in 5 hours" },
  ]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://voxsi.gg/${code}`);
    } catch {
      // Clipboard can be blocked; the mock still confirms.
    }
    setCopied(true);
    addToast({ title: "Invite link copied", color: "success" });
    window.setTimeout(() => setCopied(false), 1600);
  }

  function saveAndRegenerate() {
    const limit = maxUses === "No limit" ? "∞" : maxUses.split(" ")[0];

    setActive((a) => [
      { code, uses: `0 / ${limit}`, expires: expires === "Never" ? "never" : `in ${expires}` },
      ...a,
    ]);
    setCode(newCode(server));
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
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="px-7 pt-7 pb-0 text-[22px] font-bold tracking-tight">
          Invite friends to {server.name}
        </ModalHeader>
        <ModalBody className="gap-4 px-7 pt-4 pb-7">
          <div className="flex gap-2">
            <Input
              isReadOnly
              aria-label="Invite link"
              classNames={{ inputWrapper: "h-11 border-[#46424d] bg-[#18191d]" }}
              value={`voxsi.gg/${code}`}
              variant="bordered"
            />
            <Button
              className="btn-coral h-11 font-bold"
              startContent={<Icon name={copied ? "check" : "copy"} size={16} />}
              onPress={() => void copy()}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              classNames={{ label: "!text-sm !font-semibold !text-foreground", trigger: "h-11 border-[#46424d] bg-[#18191d]" }}
              disallowEmptySelection
              label="Expire after"
              labelPlacement="outside"
              popoverProps={{ motionProps: POPUP_MOTION_PROPS }}
              selectedKeys={[expires]}
              variant="bordered"
              onSelectionChange={(keys) => setExpires(String(Array.from(keys)[0] ?? expires))}
            >
              {EXPIRY_OPTIONS.map((o) => (
                <SelectItem key={o}>{o}</SelectItem>
              ))}
            </Select>
            <Select
              classNames={{ label: "!text-sm !font-semibold !text-foreground", trigger: "h-11 border-[#46424d] bg-[#18191d]" }}
              disallowEmptySelection
              label="Max uses"
              labelPlacement="outside"
              popoverProps={{ motionProps: POPUP_MOTION_PROPS }}
              selectedKeys={[maxUses]}
              variant="bordered"
              onSelectionChange={(keys) => setMaxUses(String(Array.from(keys)[0] ?? maxUses))}
            >
              {USES_OPTIONS.map((o) => (
                <SelectItem key={o}>{o}</SelectItem>
              ))}
            </Select>
          </div>

          <Button className="self-start" variant="light" onPress={saveAndRegenerate}>
            Save this link and generate a new one
          </Button>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-default-500">Active invites</p>
            <ul className="overflow-hidden rounded-[10px] border border-[#2f3036] bg-[#18191d]">
              {active.map((i) => (
                <li
                  key={i.code}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-[#2f3036] px-3 py-2.5 text-xs text-default-500 last:border-b-0"
                >
                  <code className="text-foreground">{i.code}</code>
                  <span>{i.uses}</span>
                  <span>{i.expires}</span>
                  <button
                    aria-label={`Revoke ${i.code}`}
                    className="text-default-500 hover:text-danger"
                    type="button"
                    onClick={() => setActive((a) => a.filter((x) => x.code !== i.code))}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </li>
              ))}
              {active.length === 0 && (
                <li className="px-3 py-3 text-center text-xs text-default-500">No active invites</li>
              )}
            </ul>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
