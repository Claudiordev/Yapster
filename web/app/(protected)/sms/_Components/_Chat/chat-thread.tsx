"use client";

import { CallPanel } from "../_Call/call-panel";
import { ChatHeader } from "./chat-header";
import { MessageComposer } from "../_Message/message-composer";
import { MessageList } from "../_Message/message-list";
import { ChatMessage } from "../chat-types";

interface ChatThreadProps {
  activeRecipient: string | null;
  draftRecipient: string;
  recipients: string[];
  displayName: (phoneNumber: string) => string;
  hasContact: (phoneNumber: string) => boolean;
  onDraftRecipientChange: (value: string) => void;
  onSelectRecipient: (recipient: string) => void;
  onEditContact: (recipient: string) => void;
  onStartCall: (recipient: string) => void;
  messages: ChatMessage[];
  messageText: string;
  onMessageTextChange: (value: string) => void;
  canSend: boolean;
  isSending: boolean;
  onSend: (e: React.FormEvent<HTMLFormElement>) => void;
  callingRecipient: string | null;
  onEndCall: () => void;
}

export function ChatThread({
  activeRecipient,
  draftRecipient,
  recipients,
  displayName,
  hasContact,
  onDraftRecipientChange,
  onSelectRecipient,
  onEditContact,
  onStartCall,
  messages,
  messageText,
  onMessageTextChange,
  canSend,
  isSending,
  onSend,
  callingRecipient,
  onEndCall,
}: ChatThreadProps) {
  const hasRecipient = (activeRecipient ?? draftRecipient).trim().length > 0;
  const headerName = activeRecipient ? displayName(activeRecipient) : "";

  return (
    <div className="flex-grow flex flex-col min-h-0 bg-background dark:bg-surface-chat text-foreground">
      <ChatHeader
        activeRecipient={activeRecipient}
        displayName={displayName}
        draftRecipient={draftRecipient}
        hasContact={hasContact}
        recipients={recipients}
        onDraftRecipientChange={onDraftRecipientChange}
        onEditContact={onEditContact}
        onSelectRecipient={onSelectRecipient}
        onStartCall={onStartCall}
      />

      {callingRecipient !== null && callingRecipient === activeRecipient && (
        <CallPanel
          recipientLabel={displayName(callingRecipient)}
          recipientSubLabel={
            hasContact(callingRecipient) ? callingRecipient : null
          }
          onEndCall={onEndCall}
        />
      )}

      <MessageList
        activeRecipient={activeRecipient}
        hasRecipient={hasRecipient}
        messages={messages}
      />

      <MessageComposer
        canSend={canSend}
        isDisabled={!hasRecipient}
        isSending={isSending}
        messageText={messageText}
        placeholder={
          activeRecipient ? `Message ${headerName}` : "Type a message…"
        }
        onMessageTextChange={onMessageTextChange}
        onSend={onSend}
      />
    </div>
  );
}
