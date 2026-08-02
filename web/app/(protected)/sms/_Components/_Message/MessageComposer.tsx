"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";

import { Icon } from "@/components/icon";

/** Max characters allowed in a single message. Must match the chat service's
 * SendMessageRequest @Size(max) — the backend is the real gate. */
export const MAX_MESSAGE_LENGTH = 5000;

interface MessageComposerProps {
  placeholder: string;
  isDisabled: boolean;
  isSending: boolean;
  onSend: (body: string) => void;
}

/**
 * Owns the draft text locally so typing only re-renders the composer — not the
 * message list above it (which would be janky with a long history).
 */
export function MessageComposer({
  placeholder,
  isDisabled,
  isSending,
  onSend,
}: MessageComposerProps) {
  const [text, setText] = useState("");

  const count = text.length;
  const over = count > MAX_MESSAGE_LENGTH;
  const canSend = text.trim().length > 0 && !over && !isDisabled;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSend) return;

    onSend(text.trim());
    setText("");
  }

  return (
    <div className="flex-shrink-0 px-4 pb-4">
      <Form
        className="flex flex-row items-center gap-3 bg-content2 rounded-large px-3 py-1.5"
        onSubmit={submit}
      >
        <Input
          aria-label="Message"
          autoComplete="off"
          classNames={{
            base: "flex-grow",
            inputWrapper:
              "bg-transparent shadow-none data-[hover=true]:bg-transparent group-data-[focus=true]:bg-transparent px-0",
            input: "text-sm",
          }}
          data-1p-ignore="true"
          data-lpignore="true"
          isDisabled={isDisabled}
          // Allow one over the limit so the counter can flag it before sending.
          maxLength={MAX_MESSAGE_LENGTH + 1}
          name="message"
          placeholder={placeholder}
          spellCheck="true"
          value={text}
          variant="flat"
          onValueChange={setText}
        />

        <span
          aria-label={`${count} of ${MAX_MESSAGE_LENGTH} characters`}
          className={`flex-shrink-0 text-tiny tabular-nums ${
            over ? "text-danger font-medium" : "text-default-400"
          }`}
        >
          {count}/{MAX_MESSAGE_LENGTH}
        </span>

        <Button
          aria-label="Send message"
          className="bg-brand hover:bg-brand-hover text-white shadow-md shadow-brand/30 flex-shrink-0"
          isDisabled={!canSend}
          isIconOnly
          isLoading={isSending}
          size="sm"
          type="submit"
        >
          <Icon name="send" size={18} />
        </Button>
      </Form>
    </div>
  );
}
