import type { ReactNode } from "react";

interface VoiceOrbitProps {
  /** Small orbit shows an icon instead of the breathing bars. */
  small?: boolean;
  children?: ReactNode;
}

/** Circular voice motif used at the top of the start card and group modal. */
export function VoiceOrbit({ small, children }: VoiceOrbitProps) {
  return (
    <div
      aria-hidden="true"
      className={`voice-orbit mx-auto ${
        small ? "voice-orbit--small" : "h-[133px] w-[133px]"
      }`}
    >
      {children ?? (
        <div className="voice-bars">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      )}
    </div>
  );
}
