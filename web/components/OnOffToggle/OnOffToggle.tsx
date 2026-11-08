import type { ReactNode } from "react";

interface OnOffToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Screen-reader name for the button. */
  label: string;
  isDisabled?: boolean;
}

/**
 * ON / OFF key in the role-badge style (red when on, grey when off). "OFF" is the wider
 * label, so it sets the size for both states and the key never resizes when switched.
 */
export function OnOffToggle({ checked, onChange, label, isDisabled = false }: OnOffToggleProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`call-role-badge !px-[9px] !py-[5px] !text-[12px] relative flex-shrink-0 cursor-pointer justify-center outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "call-role-badge--admin" : "call-role-badge--off"
      }`}
      disabled={isDisabled}
      role="switch"
      type="button"
      onClick={() => onChange(!checked)}
    >
      <span aria-hidden className="invisible">
        OFF
      </span>
      <span className="absolute inset-0 flex items-center justify-center">{checked ? "ON" : "OFF"}</span>
    </button>
  );
}

interface ToggleRowProps extends OnOffToggleProps {
  title: ReactNode;
  description?: ReactNode;
}

/** A setting row: text on the left, the ON / OFF key on the right. */
export function ToggleRow({ title, description, ...toggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className="text-small">{title}</span>
        {description && <span className="text-tiny text-default-400">{description}</span>}
      </div>
      <OnOffToggle {...toggle} />
    </div>
  );
}
