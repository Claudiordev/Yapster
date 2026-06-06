"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";

import { EditIcon } from "./edit-icon";
import { PhoneIcon } from "./phone-icon";
import { SendIcon } from "./send-icon";
import { ChatMessage, formatTime } from "./chat-types";

interface ChatThreadProps {
  activeRecipient: string | null;
  draftRecipient: string;
  displayName: (phoneNumber: string) => string;
  hasContact: (phoneNumber: string) => boolean;
  onDraftRecipientChange: (value: string) => void;
  onEditContact: (recipient: string) => void;
  onStartCall: (recipient: string) => void;
  messages: ChatMessage[];
  messageText: string;
  onMessageTextChange: (value: string) => void;
  canSend: boolean;
  isSending: boolean;
  onSend: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function ChatThread({
  activeRecipient,
  draftRecipient,
  displayName,
  hasContact,
  onDraftRecipientChange,
  onEditContact,
  onStartCall,
  messages,
  messageText,
  onMessageTextChange,
  canSend,
  isSending,
  onSend,
}: ChatThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeRecipient]);

  const hasRecipient = (activeRecipient ?? draftRecipient).trim().length > 0;
  const headerName = activeRecipient ? displayName(activeRecipient) : "";
  const headerHasContact =
    activeRecipient !== null && hasContact(activeRecipient);

  return (
    <div className="flex-grow flex flex-col gap-3 min-h-0 bg-content1 border border-divider rounded-large p-4 shadow-sm text-foreground">
      <div className="flex-shrink-0 flex items-center gap-3">
        {activeRecipient ? (
          <>
            <Avatar
              className="bg-[#FF3B47]/10 text-[#FF3B47] shadow-sm ring-1 ring-[#FF3B47]/20"
              icon={<PhoneIcon size={20} />}
              size="md"
            />
            <div className="flex flex-col flex-grow min-w-0">
              <h2 className="text-large font-semibold truncate text-foreground">
                {headerName}
              </h2>
              {headerHasContact && (
                <span className="text-tiny text-default-500 truncate">
                  {activeRecipient}
                </span>
              )}
            </div>
            <Button
              isIconOnly
              aria-label={
                headerHasContact
                  ? `Edit contact ${headerName}`
                  : `Add ${activeRecipient} to contacts`
              }
              className="text-default-500 hover:text-foreground"
              size="sm"
              variant="light"
              onPress={() => onEditContact(activeRecipient)}
            >
              <EditIcon size={18} />
            </Button>
            <Button
              aria-label={`Call ${headerName}`}
              className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
              isIconOnly
              radius="full"
              size="sm"
              onPress={() => onStartCall(activeRecipient)}
            >
              <PhoneIcon size={16} />
            </Button>
          </>
        ) : (
          <Input
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            label="Recipient"
            labelPlacement="outside"
            placeholder="+1 (555) 123-4567"
            size="lg"
            startContent={
              <span className="text-default-400 text-sm">📞</span>
            }
            type="tel"
            value={draftRecipient}
            variant="bordered"
            onValueChange={onDraftRecipientChange}
          />
        )}
      </div>

      <div className="h-px bg-divider" />

      <div className="flex-grow overflow-y-auto flex flex-col gap-3 px-1 min-h-0">
        {messages.length === 0 && (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-default-400 text-center text-sm">
              {hasRecipient
                ? "No messages yet. Start the conversation."
                : "Enter a phone number to start a new chat."}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[75%] flex flex-col items-end gap-1">
              <div className="bg-[#FF3B47] text-white rounded-2xl rounded-br-sm px-3.5 py-2 shadow-md shadow-[#FF3B47]/20">
                <p className="text-sm break-words">{msg.body}</p>
              </div>
              <span className="text-tiny text-default-400">
                {formatTime(msg.sentAt)}
              </span>
              {msg.error && (
                <span className="text-danger text-tiny">{msg.error}</span>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0">
        <div className="h-px bg-divider mb-3" />
        <Form className="flex flex-row gap-2 items-center" onSubmit={onSend}>
          <Input
            autoComplete="off"
            className="flex-grow"
            data-1p-ignore="true"
            data-lpignore="true"
            isDisabled={!hasRecipient}
            name="message"
            placeholder="Type a message..."
            spellCheck="true"
            value={messageText}
            variant="bordered"
            onValueChange={onMessageTextChange}
          />
          <Button
            aria-label="Send message"
            className="bg-[#FF3B47] hover:bg-[#E62D3A] text-white shadow-md shadow-[#FF3B47]/30"
            isDisabled={!canSend}
            isIconOnly
            isLoading={isSending}
            type="submit"
          >
            <SendIcon size={18} />
          </Button>
        </Form>
      </div>
    </div>
  );
}
