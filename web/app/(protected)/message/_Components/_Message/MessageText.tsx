"use client";

import { useEmbedReady } from "@/app/(protected)/message/_Actions/useEmbedReady";

import { isEmojiOnlyBody, isImageOnlyBody, linkifyBody } from "./utils/embeds";

/**
 * The text of a message, with its links clickable. Nothing is drawn when the
 * message is only a picture, or only a link whose preview is showing (the
 * preview is then the message; the link stays visible if it fails to load).
 */
export function MessageText({
  body,
  pending,
}: {
  body: string;
  pending?: boolean;
}) {
  // Embeds only render once the message is sent, so the link stays until then.
  const previewShowing = useEmbedReady(body, !pending);

  if (isImageOnlyBody(body) || previewShowing) return null;

  // Emoji-only messages are shown large, like Discord; any text keeps the normal size.
  const size = isEmojiOnlyBody(body) ? "text-4xl leading-tight" : "text-sm";

  return (
    <p
      className={`${size} text-foreground whitespace-pre-wrap [overflow-wrap:anywhere] ${
        pending ? "opacity-60" : ""
      }`}
    >
      {linkifyBody(body).map((part, index) =>
        part.href ? (
          <a
            key={index}
            className="underline-offset-2 hover:underline"
            href={part.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}
