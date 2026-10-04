"use client";

import { useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { Button } from "@heroui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";
import { EmojiStyle, Theme, type EmojiClickData } from "emoji-picker-react";
import { useTheme } from "next-themes";

import { Icon } from "@/components/Icon/Icon";
import { POPUP_MOTION_PROPS } from "@/lib/popupMotion";

// Loaded on first open: the picker and its emoji data are sizeable and touch `window`.
const Picker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const token = (name: string) => `hsl(var(--heroui-${name}))`;

/**
 * The library paints itself through `--epr-*` variables; pointing them at the
 * same HeroUI tokens the GIF popup uses (flat default-100 search field, default-200
 * hover, brand accents, no border) makes the two popups match in light and dark.
 * Both the light and `--epr-dark-*` sets are given the same values, because the
 * tokens already switch with the theme.
 */
const PICKER_VARS = Object.fromEntries(
  (
    [
      ["bg-color", "transparent"],
      ["text-color", token("foreground")],
      ["picker-border-color", "transparent"],
      ["picker-border-radius", "0"],
      ["search-input-bg-color", token("default-100")],
      ["search-input-bg-color-active", token("default-100")],
      ["search-border-color", "transparent"],
      ["search-border-color-active", "var(--color-brand)"],
      ["search-input-border-radius", "var(--heroui-radius-medium)"],
      ["search-input-height", "32px"],
      ["search-input-text-color", token("foreground")],
      ["hover-bg-color", token("default-200")],
      ["focus-bg-color", token("default-200")],
      ["highlight-color", "var(--color-brand)"],
      ["category-icon-active-color", "var(--color-brand)"],
      ["category-icon-inactive-color", token("default-500")],
      ["category-label-bg-color", token("content1")],
      ["category-label-text-color", token("default-500")],
    ] as const
  ).flatMap(([name, value]) => [
    [`--epr-${name}`, value],
    [`--epr-dark-${name}`, value],
  ]),
) as CSSProperties;

interface EmojiPickerProps {
  isDisabled?: boolean;
  /** Applied to the trigger button so it matches the Send/GIF buttons (see COMPOSER_ACTION_BUTTON_CLASS). */
  triggerClassName?: string;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({
  isDisabled,
  triggerClassName,
  onSelect,
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  function pick({ emoji }: EmojiClickData) {
    setIsOpen(false);
    onSelect(emoji);
  }

  return (
    <Popover
      isOpen={isOpen}
      motionProps={POPUP_MOTION_PROPS}
      placement="top-end"
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger>
        <Button
          aria-label="Add an emoji"
          className={triggerClassName}
          isDisabled={isDisabled}
          // The popup is anchored to this button, so it must not scale/shift
          // on press or the popup jumps as it opens.
          disableAnimation
          isIconOnly
          size="sm"
          variant="light"
        >
          <Icon name="smile" size={18} />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[30rem] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0">
        <Picker
          autoFocusSearch
          // Native glyphs, so the picker shows exactly what the message will: the
          // inserted text is plain Unicode, drawn by the reader's own emoji font.
          emojiStyle={EmojiStyle.NATIVE}
          height={466}
          previewConfig={{ showPreview: false }}
          style={PICKER_VARS}
          theme={resolvedTheme === "light" ? Theme.LIGHT : Theme.DARK}
          width="100%"
          onEmojiClick={pick}
        />
      </PopoverContent>
    </Popover>
  );
}
