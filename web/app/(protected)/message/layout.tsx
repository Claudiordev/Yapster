import { Suspense } from "react";

import { CallProvider } from "./_Components/CallProvider";
import { ChatProvider } from "./_Components/ChatProvider";
import { ChatShell } from "./_Components/ChatShell";
import { LinkedAccountNotice } from "./_Components/LinkedAccountNotice";
import { ServersProvider } from "./_Components/ServersProvider";

export default function SmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <CallProvider>
        <ServersProvider>
          <ChatShell>{children}</ChatShell>
        </ServersProvider>
        <Suspense fallback={null}>
          <LinkedAccountNotice />
        </Suspense>
      </CallProvider>
    </ChatProvider>
  );
}
