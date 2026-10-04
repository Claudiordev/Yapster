import { Suspense } from "react";

import { CallProvider } from "./_Components/CallProvider";
import { ChatProvider } from "./_Components/ChatProvider";
import { ChatShell } from "./_Components/ChatShell";
import { LinkedAccountNotice } from "./_Components/LinkedAccountNotice";

export default function SmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <CallProvider>
        <ChatShell>{children}</ChatShell>
        <Suspense fallback={null}>
          <LinkedAccountNotice />
        </Suspense>
      </CallProvider>
    </ChatProvider>
  );
}
