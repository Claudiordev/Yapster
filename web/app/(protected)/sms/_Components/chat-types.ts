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
