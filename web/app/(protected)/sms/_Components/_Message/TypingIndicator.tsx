"use client";

interface TypingIndicatorProps {
  /** Display names of the people currently typing. Empty renders nothing. */
  names: string[];
}

/** "Alice is typing…" with three bouncing dots, above the composer. */
export function TypingIndicator({ names }: TypingIndicatorProps) {
  const label =
    names.length === 0
      ? null
      : names.length === 1
        ? `${names[0]} is typing`
        : names.length === 2
          ? `${names[0]} and ${names[1]} are typing`
          : `${names.length} people are typing`;

  // Always render the row so the thread doesn't jump when it appears.
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 px-5 pb-1.5 h-5 text-tiny text-default-400"
    >
      {label && (
        <>
          <span aria-hidden className="flex items-end gap-0.5">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1 w-1 rounded-full bg-default-400 animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          <span>{label}…</span>
        </>
      )}
    </div>
  );
}
