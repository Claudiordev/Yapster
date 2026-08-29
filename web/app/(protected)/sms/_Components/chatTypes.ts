export interface ChatMessage {
  id: string;
  providerId?: string;
  body: string;
  to: string;
  status: string;
  pending: boolean;
  error?: string;
  price?: string;
  priceUnit?: string;
  sentAt: number;
}

export function formatTime(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// "10:32 AM"
export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// "Today" / "Yesterday" / "December 27, 2024" — for date separators
export function formatDateDivider(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// "Today at 10:32 AM" / "Yesterday at 10:32 AM" / "12/27/24 10:32 AM"
export function formatMessageStamp(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  const clock = formatClock(ts);

  if (date.toDateString() === today.toDateString()) return `Today at ${clock}`;
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${clock}`;
  }

  return `${date.toLocaleDateString([], {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  })} ${clock}`;
}
