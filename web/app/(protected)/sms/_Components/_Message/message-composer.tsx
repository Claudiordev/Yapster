"use client";

import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";

import { Icon } from "@/components/icon";

interface MessageComposerProps {
  placeholder: string;
  isDisabled: boolean;
  messageText: string;
  onMessageTextChange: (value: string) => void;
  canSend: boolean;
  isSending: boolean;
  onSend: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function MessageComposer({
  placeholder,
  isDisabled,
  messageText,
  onMessageTextChange,
  canSend,
  isSending,
  onSend,
}: MessageComposerProps) {
  return (
    <div className="flex-shrink-0 px-4 pb-4">
      <Form
        className="flex flex-row items-center gap-2 bg-content2 rounded-large px-3 py-1.5"
        onSubmit={onSend}
      >
        <Input
          aria-label="Message"
          autoComplete="off"
          classNames={{
            inputWrapper:
              "bg-transparent shadow-none data-[hover=true]:bg-transparent group-data-[focus=true]:bg-transparent px-0",
            input: "text-sm",
          }}
          data-1p-ignore="true"
          data-lpignore="true"
          isDisabled={isDisabled}
          name="message"
          placeholder={placeholder}
          spellCheck="true"
          value={messageText}
          variant="flat"
          onValueChange={onMessageTextChange}
        />
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
