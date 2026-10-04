"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Textarea } from "@heroui/input";

import { Icon } from "@/components/Icon/Icon";
import { useAccount } from "@/lib/hooks/useAccount";

import { EmojiPicker } from "./EmojiPicker";
import { GifPicker } from "./GifPicker";

/** Max characters allowed in a single message. Must match the chat service's
 * SendMessageRequest @Size(max) — the backend is the real gate. */
export const MAX_MESSAGE_LENGTH = 5000;

/** Shared style for every icon-only action button in the composer (Send, GIF, …):
 * the same raised button the profile card uses for Settings, so they read as
 * one button family. Pair it with `variant="light"`; the color modifiers below
 * (see globals.css) keep each action's own fill. */
export const COMPOSER_ACTION_BUTTON_CLASS =
  "chat-profile-action chat-profile-settings min-w-9 flex-shrink-0";
export const COMPOSER_SEND_BUTTON_COLOR_CLASS = "chat-profile-action--send";
/** Blue; shared by the GIF and emoji pickers, which open a popup from the button. */
export const COMPOSER_GIF_BUTTON_COLOR_CLASS = "chat-profile-action--gif";

interface MessageComposerProps {
  placeholder: string;
  isDisabled: boolean;
  isSending: boolean;
  onSend: (body: string) => void;
  /** Called on every keystroke. Throttling lives in useTyping, not here. */
  onType?: () => void;
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
  onType,
}: MessageComposerProps) {
  const { isFeatureEnabled } = useAccount();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const count = text.length;
  const over = count > MAX_MESSAGE_LENGTH;
  const canSend = text.trim().length > 0 && !over && !isDisabled;

  function send() {
    if (!canSend) return;

    // trim() only strips the ends; line breaks inside the message are kept.
    onSend(text.trim());
    setText("");
  }

  // Insert at the caret (replacing any selection) the same native way as the
  // Ctrl+Enter break above, so undo and the caret position keep working.
  function insertEmoji(emoji: string) {
    const el = inputRef.current;

    if (!el) {
      setText((t) => t + emoji);

      return;
    }

    el.focus();
    el.setRangeText(emoji, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send();
  }

  // Enter sends. Shift+Enter (native) and Ctrl/Cmd+Enter start a new paragraph.
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;

    if (e.shiftKey) return; // a textarea already inserts the line break

    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Insert at the caret natively so the caret lands right after the break
      // immediately (no re-render race with fast typing) and undo still works.
      const el = e.currentTarget;

      el.setRangeText("\n", el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, "end");
      el.dispatchEvent(new Event("input", { bubbles: true }));

      return;
    }

    send();
  }

  return (
    <div className="flex-shrink-0 px-4 pb-4">
      <Form
        className="flex flex-row items-start gap-3 bg-content2 rounded-large px-4 py-2.5"
        onSubmit={submit}
      >
        <Textarea
          aria-label="Message"
          autoComplete="off"
          classNames={{
            base: "flex-grow",
            inputWrapper:
              "min-h-9 !bg-transparent px-0 py-0 shadow-none data-[hover=true]:!bg-transparent group-data-[focus=true]:!bg-transparent",
            // py-2 + the 20px line makes one line exactly as tall as the buttons.
            input: "py-2 text-sm leading-5",
          }}
          data-1p-ignore="true"
          data-lpignore="true"
          isDisabled={isDisabled}
          // Allow one over the limit so the counter can flag it before sending.
          maxLength={MAX_MESSAGE_LENGTH + 1}
          maxRows={8}
          minRows={1}
          name="message"
          ref={inputRef}
          placeholder={placeholder}
          spellCheck="true"
          value={text}
          variant="flat"
          onKeyDown={handleKeyDown}
          onValueChange={(v) => {
            setText(v);
            if (v.length > 0) onType?.();
          }}
        />

        <span
          aria-label={`${count} of ${MAX_MESSAGE_LENGTH} characters`}
          className={`flex h-9 flex-shrink-0 items-center text-tiny tabular-nums ${
            over ? "text-danger font-medium" : "text-default-400"
          }`}
        >
          {count}/{MAX_MESSAGE_LENGTH}
        </span>

        <EmojiPicker
          isDisabled={isDisabled || !isFeatureEnabled("emojis")}
          triggerClassName={`${COMPOSER_ACTION_BUTTON_CLASS} ${COMPOSER_GIF_BUTTON_COLOR_CLASS}`}
          onSelect={insertEmoji}
        />

        <GifPicker
          isDisabled={isDisabled || !isFeatureEnabled("gif")}
          triggerClassName={`${COMPOSER_ACTION_BUTTON_CLASS} ${COMPOSER_GIF_BUTTON_COLOR_CLASS}`}
          onSelect={(gifUrl) => onSend(gifUrl)}
        />

        <Button
          aria-label="Send message"
          className={`${COMPOSER_ACTION_BUTTON_CLASS} ${COMPOSER_SEND_BUTTON_COLOR_CLASS}`}
          isDisabled={!canSend}
          isIconOnly
          isLoading={isSending}
          size="sm"
          type="submit"
          variant="light"
        >
          <Icon name="send" size={18} />
        </Button>
      </Form>
    </div>
  );
}
