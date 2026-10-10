"use client";

import { EventsPromo } from "./_Chat/EventsPromo";
import { StartChatForm } from "./_Chat/StartChatForm";
import { useChat } from "./ChatProvider";

/** The "Main" home panel shown at /message when no conversation is open. */
export function MainPage() {
  const { startConversation, createGroup } = useChat();

  return (
    <div className="flex flex-col flex-grow min-h-0 bg-background dark:bg-surface-chat">
      <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-divider shadow-sm">
        <h2 className="font-semibold text-foreground">Main</h2>
      </div>

      <div className="flex-grow overflow-y-auto flex flex-col items-center justify-center p-6">
        <div className="start-card w-full max-w-[520px] px-6 py-8 text-center sm:px-9">
          <EventsPromo />

          <div className="my-7 h-px bg-white/10" />

          <h1 className="text-[27px] font-bold leading-tight tracking-tight text-foreground">
            Start a conversation.
          </h1>
          <p className="mb-6 mt-2 text-sm text-default-500">
            Pick one friend or a few.
          </p>

          <StartChatForm
            onCreateGroup={createGroup}
            onStartConversation={startConversation}
          />
        </div>

        <p className="mt-7 text-sm text-default-400">
          Your people. Your space.{" "}
          <span className="text-default-600">Your voice.</span>
        </p>
      </div>
    </div>
  );
}
