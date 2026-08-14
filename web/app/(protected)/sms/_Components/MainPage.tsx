"use client";

import { UserSearch } from "./_Chat/UserSearch";
import { useChat } from "./ChatProvider";

/** The "Main" home panel shown at /sms when no conversation is open. */
export function MainPage() {
  const { startConversation } = useChat();

  return (
    <div className="flex flex-col flex-grow min-h-0 bg-background dark:bg-surface-chat">
      <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-divider shadow-sm">
        <h2 className="font-semibold text-foreground">Main</h2>
      </div>

      <div className="flex-grow overflow-y-auto flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-full max-w-md">
          <UserSearch onStartConversation={startConversation} />
        </div>
        <p className="text-default-400 text-sm text-center">
          Search for someone above to start a conversation.
        </p>
      </div>
    </div>
  );
}
