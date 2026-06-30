import { MicStatus } from "./use-mic-stream";

export function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");

  return `${mm}:${ss}`;
}

export function statusLabel(status: MicStatus): string {
  switch (status) {
    case "requesting":
      return "Asking for microphone…";
    case "denied":
      return "Microphone denied";
    case "error":
      return "Microphone unavailable";
    default:
      return "In call";
  }
}
