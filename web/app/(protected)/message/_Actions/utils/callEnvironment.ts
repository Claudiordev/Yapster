/** localhost, loopback, or RFC1918: addresses that only mean "this network". */
function isLocalAddress(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * The voice service names one LiveKit host. When it is a local/private address,
 * retarget it at the host this browser used to reach the app (same idea as the
 * chat socket's resolveWsBase()); a public hostname is left alone.
 */
export function livekitUrlForThisBrowser(serverUrl: string): string {
  if (typeof window === "undefined") return serverUrl;

  try {
    const url = new URL(serverUrl);

    if (!isLocalAddress(url.hostname)) return serverUrl;

    url.hostname = window.location.hostname;
    // A wss:// page can't open a ws:// socket.
    url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    return url.toString();
  } catch {
    return serverUrl;
  }
}

/** An active media session exempts the tab from background throttling that would drop a backgrounded call. */
export function setMediaSessionActive(title: string) {
  if (typeof navigator === "undefined" || !navigator.mediaSession) return;

  navigator.mediaSession.metadata = new MediaMetadata({ title });
  navigator.mediaSession.playbackState = "playing";
}

export function clearMediaSession() {
  if (typeof navigator === "undefined" || !navigator.mediaSession) return;

  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
}
