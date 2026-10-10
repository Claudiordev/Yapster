"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

import { POPUP_MOTION_PROPS } from "@/lib/popupMotion";
import type { ServerChannel, ServerChannelKind } from "@/types/server";

interface CreateChannelModalProps {
  isOpen: boolean;
  categories: string[];
  /** When set the modal edits this channel instead of creating a new one. */
  channel?: ServerChannel;
  onClose: () => void;
  onSubmit: (channel: ServerChannel) => void;
}

/** Create a channel, or edit one from its right-click menu. Mount with a `key` per channel when editing. */
export function CreateChannelModal({ isOpen, categories, channel, onClose, onSubmit }: CreateChannelModalProps) {
  const editing = Boolean(channel);
  const [name, setName] = useState(channel?.name ?? "");
  const [topic, setTopic] = useState(channel?.topic ?? "");
  const [kind, setKind] = useState<ServerChannelKind>(channel?.kind ?? "text");
  const [category, setCategory] = useState<string | null>(channel?.category ?? null);
  const [isPrivate, setIsPrivate] = useState(channel ? channel.minView !== "member" : false);

  const chosenCategory = category ?? categories[0] ?? "TEXT CHANNELS";
  const clean = kind === "voice" ? name.trim() : name.trim().toLowerCase().replace(/\s+/g, "-");

  function close() {
    if (!editing) {
      setName("");
      setTopic("");
      setKind("text");
      setCategory(null);
      setIsPrivate(false);
    }
    onClose();
  }

  function submit() {
    if (!clean) return;
    onSubmit({
      id: channel?.id ?? `c${Date.now()}`,
      name: clean,
      kind,
      category: chosenCategory,
      minView: isPrivate ? "mod" : "member",
      minSend: isPrivate ? "mod" : (channel?.minSend ?? "member"),
      topic: kind === "voice" ? undefined : topic.trim() || undefined,
      voiceMembers: kind === "voice" ? (channel?.voiceMembers ?? []) : undefined,
    });
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
        <ModalHeader className="px-7 pt-7 pb-0 text-[22px] font-bold tracking-tight">
          {editing ? `Edit #${channel?.name}` : "Create channel"}
        </ModalHeader>
        <ModalBody className="gap-4 px-7 pt-4">
          {!editing && (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "text", label: "# Text", hint: "Messages, GIFs and links" },
                  { id: "voice", label: "⌁ Voice", hint: "Talk, video and screen share" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  aria-pressed={kind === t.id}
                  className={`flex flex-col rounded-[10px] border px-4 py-3 text-left transition-colors ${
                    kind === t.id ? "border-brand bg-brand/10" : "border-[#46424d] bg-[#18191d] hover:bg-[#202126]"
                  }`}
                  type="button"
                  onClick={() => setKind(t.id)}
                >
                  <span className="text-sm font-semibold text-foreground">{t.label}</span>
                  <span className="text-xs text-default-500">{t.hint}</span>
                </button>
              ))}
            </div>
          )}
          <Input
            classNames={{
              label: "!text-sm !font-semibold !text-foreground",
              inputWrapper: "h-11 border-[#46424d] bg-[#18191d]",
            }}
            label="Channel name"
            labelPlacement="outside"
            maxLength={40}
            placeholder={kind === "text" ? "new-channel" : "New voice room"}
            value={name}
            variant="bordered"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            onValueChange={setName}
          />
          {kind !== "voice" && (
            <Input
              classNames={{
                label: "!text-sm !font-semibold !text-foreground",
                inputWrapper: "h-11 border-[#46424d] bg-[#18191d]",
              }}
              label="Topic"
              labelPlacement="outside"
              maxLength={120}
              placeholder="What is this channel for?"
              value={topic}
              variant="bordered"
              onKeyDown={(e) => e.key === "Enter" && submit()}
              onValueChange={setTopic}
            />
          )}
          <Select
            classNames={{ label: "!text-sm !font-semibold !text-foreground", trigger: "h-11 border-[#46424d] bg-[#18191d]" }}
            disallowEmptySelection
            label="Category"
            labelPlacement="outside"
            popoverProps={{ motionProps: POPUP_MOTION_PROPS }}
            selectedKeys={[chosenCategory]}
            variant="bordered"
            onSelectionChange={(keys) => setCategory(String(Array.from(keys)[0] ?? chosenCategory))}
          >
            {categories.map((c) => (
              <SelectItem key={c}>{c}</SelectItem>
            ))}
          </Select>
          <div className="flex items-center justify-between rounded-[10px] border border-[#46424d] bg-[#18191d] px-4 py-3">
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Private channel</span>
              <span className="text-xs text-default-500">Only Moderators and above can see it</span>
            </span>
            <Switch color="danger" isSelected={isPrivate} size="sm" onValueChange={setIsPrivate} />
          </div>
        </ModalBody>
        <ModalFooter className="px-7 pb-7">
          <Button variant="light" onPress={close}>
            Cancel
          </Button>
          <Button className="btn-coral font-bold" isDisabled={!clean} onPress={submit}>
            {editing ? "Save changes" : "Create channel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
