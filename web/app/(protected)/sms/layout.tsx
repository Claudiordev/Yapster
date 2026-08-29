import { ChatProvider } from "./_Components/ChatProvider";
import { ChatShell } from "./_Components/ChatShell";

export default function SmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <ChatShell>{children}</ChatShell>
    </ChatProvider>
  );
}
