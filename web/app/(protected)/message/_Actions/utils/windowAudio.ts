/**
 * Chrome's `windowAudio` display-media option (Chrome ~141+): when the user shares a
 * window, capture that window's own audio instead of offering the whole system's.
 * Values: "window" (the window only), "system", "exclude".
 *
 * livekit-client builds the getDisplayMedia request itself and does not pass this member
 * through, so for the one capture started inside `task` we add it to that request.
 * Browsers that don't know the member ignore it, so this is safe everywhere.
 */
type WindowAudioMode = "window" | "system" | "exclude";

export async function withWindowAudio<T>(
  task: () => Promise<T>,
  mode: WindowAudioMode = "window",
): Promise<T> {
  const devices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;

  if (!devices?.getDisplayMedia) return task();

  const original = devices.getDisplayMedia;
  let patched = true;

  const restore = () => {
    if (!patched) return;
    patched = false;
    devices.getDisplayMedia = original;
  };

  devices.getDisplayMedia = function (this: MediaDevices, options?: DisplayMediaStreamOptions) {
    // Only the first capture of this share gets the option; put the browser's own function back.
    restore();

    return original.call(this, { ...options, windowAudio: mode } as DisplayMediaStreamOptions);
  };

  try {
    return await task();
  } finally {
    restore();
  }
}
