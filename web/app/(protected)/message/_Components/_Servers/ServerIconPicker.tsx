"use client";

import { useRef } from "react";
import { addToast } from "@heroui/toast";

import { Icon } from "@/components/Icon/Icon";

/** Same limit the profile picture upload enforces. */
const MAX_ICON_BYTES = 2 * 1024 * 1024;

interface ServerIconPickerProps {
  /** Current icon, if any. */
  value?: string;
  /** Used for the initials fallback. */
  name: string;
  size?: number;
  disabled?: boolean;
  onChange: (iconUrl: string | undefined) => void;
}

/** Click the square to choose a server icon, like changing a profile picture. Mocked: kept as a data URL. */
export function ServerIconPicker({ value, name, size = 88, disabled = false, onChange }: ServerIconPickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = ""; // allow choosing the same file again
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast({ title: "Please choose an image file.", color: "danger" });

      return;
    }

    if (file.size > MAX_ICON_BYTES) {
      addToast({ title: "That image is over 2MB.", color: "danger" });

      return;
    }

    const reader = new FileReader();

    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        aria-label="Change server icon"
        className="group relative overflow-hidden rounded-[22px] border-2 border-dashed border-default-300 bg-default-100 text-3xl font-bold text-brand transition-colors hover:border-brand disabled:cursor-not-allowed"
        disabled={disabled}
        style={{ width: size, height: size }}
        type="button"
        onClick={() => fileInput.current?.click()}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-full w-full object-cover" src={value} />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            {name.trim() ? name.trim().charAt(0).toUpperCase() : <Icon name="plus" size={size / 3} />}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Icon name="edit" size={size / 4} />
        </span>
      </button>
      <input ref={fileInput} accept="image/*" className="hidden" type="file" onChange={pick} />

      {value && !disabled ? (
        <button className="text-tiny text-default-500 hover:text-danger" type="button" onClick={() => onChange(undefined)}>
          Remove icon
        </button>
      ) : (
        <span className="text-tiny text-default-400">{disabled ? "Icon" : "Upload an icon, max 2MB"}</span>
      )}
    </div>
  );
}
