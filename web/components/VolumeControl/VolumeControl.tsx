"use client";

interface VolumeControlProps {
  name: string;
  /** Small caption under the name, e.g. "Voice volume". */
  caption?: string;
  ariaLabel: string;
  volume: number;
  onChange: (volume: number) => void;
}

/** Name + percentage header and a 0-200% volume slider (call volume menus). */
export function VolumeControl({
  name,
  caption,
  ariaLabel,
  volume,
  onChange,
}: VolumeControlProps) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          {caption && <p className="text-tiny text-default-500">{caption}</p>}
        </div>
        <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {volume}%
        </span>
      </div>
      <input
        aria-label={ariaLabel}
        className="volume-bar w-full"
        max={200}
        min={0}
        step={1}
        type="range"
        value={volume}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </>
  );
}
