"use client";

import { RedVoidBackdrop } from "@/components/RedVoidBackdrop/RedVoidBackdrop";

const STAGES = [
  "Warming things up…",
  "Tuning your audio…",
  "Bringing everyone closer…",
  "Almost there…",
] as const;

/** The signal bars: heights in px and animation delays in seconds, mirrored around the middle. */
const BARS = [
  { height: 19, delay: -0.2 },
  { height: 30, delay: -0.3 },
  { height: 43, delay: -0.7 },
  { height: 27, delay: -0.5 },
  { height: 43, delay: -0.7 },
  { height: 30, delay: -0.3 },
  { height: 19, delay: -0.2 },
] as const;

interface AuthLoadingProps {
  /** 0-100, moved by the real work behind it (login request, then the app's first data). */
  progress: number;
}

/**
 * Full-screen sign-in loader: the Voxsi card with the signal bars and a progress bar.
 * It draws whatever `progress` it is given, so the bar only moves when a step really finished.
 */
export function AuthLoading({ progress }: AuthLoadingProps) {
  const stage = Math.min(STAGES.length - 1, Math.floor(progress / 26));
  const complete = progress >= 100;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#070507] px-5">
      {/* Same backdrop as the login page, so the card appears where the form was. */}
      <RedVoidBackdrop />
      <section
        aria-labelledby="auth-loading-title"
        className="relative z-10 w-full max-w-[470px] rounded-[22px] border border-[#454348] bg-gradient-to-br from-[#2d2d32] to-[#252629] px-6 pb-7 pt-8 text-center shadow-[0_5px_0_#19191e,0_24px_85px_rgba(0,0,0,0.33),inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-[38px] sm:pb-8 sm:pt-10"
      >
        <div
          aria-hidden
          className="mx-auto mb-7 flex h-[52px] items-center justify-center gap-[5px]"
        >
          {BARS.map((bar, index) => (
            <i
              key={index}
              className={`block w-[5px] rounded-full bg-brand shadow-[0_0_12px_rgba(255,59,71,0.13)] ${
                complete ? "" : "auth-speak-bar"
              }`}
              style={{
                height: bar.height,
                ["--speak-delay" as string]: `${bar.delay}s`,
              }}
            />
          ))}
        </div>

        <h1
          className="text-[25px] font-bold leading-tight tracking-tight text-[#f5f3f4] sm:text-[27px]"
          id="auth-loading-title"
        >
          {complete ? "Ready when you are." : "Finding your frequency."}
        </h1>
        <p className="mb-8 mt-2.5 text-[14px] leading-relaxed text-[#b0adb5] sm:text-[15px]">
          {complete
            ? "A little closer to your people."
            : "Good conversations are worth a moment."}
        </p>

        <div className="mb-3 flex items-center justify-between gap-3 text-[13px] text-[#c5c2ca]">
          <span role="status">{complete ? "Signed in" : STAGES[stage]}</span>
          <span aria-hidden className="font-semibold tabular-nums text-[#eee]">
            {progress}%
          </span>
        </div>
        <div
          aria-label="Signing you in"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="h-[7px] overflow-hidden rounded-md bg-[#17181c] shadow-[inset_0_1px_2px_rgba(0,0,0,0.27)]"
          role="progressbar"
        >
          <div
            className="h-full rounded-md bg-gradient-to-r from-brand-hover to-brand shadow-[0_0_16px_rgba(255,59,71,0.27)] transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div aria-hidden className="mt-6 flex justify-center gap-1.5">
          {STAGES.map((name, index) => (
            <span
              key={name}
              className={`h-[3px] w-[22px] rounded transition-colors duration-300 ${
                index <= stage ? "bg-brand" : "bg-[#555259]"
              }`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
