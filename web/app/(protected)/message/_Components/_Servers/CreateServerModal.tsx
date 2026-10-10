"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";

import { Icon } from "@/components/Icon/Icon";
import type { ServerTemplate } from "@/types/server";

import { ServerIconPicker } from "./ServerIconPicker";
import { SERVER_TEMPLATES } from "./utils/mockServers";

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, template: ServerTemplate, iconUrl?: string) => void;
}

export function CreateServerModal({ isOpen, onClose, onCreate }: CreateServerModalProps) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<ServerTemplate>("gaming");
  const [iconUrl, setIconUrl] = useState<string | undefined>();

  function close() {
    setName("");
    setTemplate("gaming");
    setIconUrl(undefined);
    onClose();
  }

  function submit() {
    if (!name.trim()) return;
    onCreate(name.trim(), template, iconUrl);
    close();
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
      onClose={close}
    >
      <ModalContent>
        <ModalHeader className="flex-col items-center gap-1 px-7 pt-7 pb-0 text-center">
          <ServerIconPicker name={name} value={iconUrl} onChange={setIconUrl} />
          <h2 className="mt-3 text-[25px] font-bold tracking-tight text-foreground">Create your server</h2>
          <p className="text-sm font-normal text-default-500">
            Where you and your crew talk, play and share. You can change everything later.
          </p>
        </ModalHeader>
        <ModalBody className="gap-4 px-7 pt-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">Start from a template</span>
            {SERVER_TEMPLATES.map((t) => (
              <button
                key={t.id}
                aria-pressed={template === t.id}
                className={`flex flex-col rounded-[10px] border px-4 py-3 text-left transition-colors ${
                  template === t.id
                    ? "border-brand bg-brand/10"
                    : "border-[#46424d] bg-[#18191d] hover:bg-[#202126]"
                }`}
                type="button"
                onClick={() => setTemplate(t.id)}
              >
                <span className="text-sm font-semibold text-foreground">{t.label}</span>
                <span className="text-xs text-default-500">{t.hint}</span>
              </button>
            ))}
          </div>
          <Input
            classNames={{
              label: "!text-sm !font-semibold !text-foreground",
              inputWrapper: "h-11 border-[#46424d] bg-[#18191d]",
            }}
            label="Server name"
            labelPlacement="outside"
            maxLength={40}
            placeholder="e.g. Night owls"
            value={name}
            variant="bordered"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            onValueChange={setName}
          />
        </ModalBody>
        <ModalFooter className="px-7 pb-7">
          <Button variant="light" onPress={close}>
            Cancel
          </Button>
          <Button className="btn-coral font-bold" isDisabled={!name.trim()} onPress={submit}>
            Create server
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
