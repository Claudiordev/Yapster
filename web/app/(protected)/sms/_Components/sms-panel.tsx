"use client";

import { useState } from "react";

import { ChatList } from "./_Chat/chat-list";
import { ChatNav } from "./_Chat/chat-nav";
import { ChatProfile } from "./_Chat/chat-profile";
import { ChatThread } from "./_Chat/chat-thread";
import { ContactModal } from "./_Contacts/contact-modal";
import { AppPanel } from "./_Panels/AppPanel";
import { CommunitiesPanel } from "./_Panels/CommunitiesPanel";
import { GameServersPanel } from "./_Panels/GameServersPanel";
import { CHAT_PANELS, type PanelKey } from "./_Panels/panels";
import { useContacts } from "./_Contacts/use-contacts";
import { useMessages } from "./_Message/use-messages";

export function SmsPanel() {
  const [activeRecipient, setActiveRecipient] = useState<string | null>(null);
  const [draftRecipient, setDraftRecipient] = useState("");
  const [messageText, setMessageText] = useState("");
  const [editingRecipient, setEditingRecipient] = useState<string | null>(null);
  const [callingRecipient, setCallingRecipient] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);

  const { displayName, hasContact, setContactName } = useContacts();
  const { recipients, getThread, sendMessage, isSending } = useMessages();

  const activeMessages = getThread(activeRecipient);
  const panelMeta = CHAT_PANELS.find((p) => p.key === activePanel) ?? null;
  const currentRecipient = activeRecipient ?? draftRecipient;
  const canSend =
    messageText.trim().length > 0 && currentRecipient.trim().length > 0;

  function startNewChat() {
    setActiveRecipient(null);
    setDraftRecipient("");
    setMessageText("");
  }

  function saveContact(name: string) {
    if (editingRecipient) {
      setContactName(editingRecipient, name);
    }
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSend) return;

    const recipient = currentRecipient.trim();
    const body = messageText.trim();

    setMessageText("");
    setActiveRecipient(recipient);
    setDraftRecipient("");

    await sendMessage(recipient, body);
  }

  return (
    <>
      <div className="flex flex-row flex-grow min-h-0 text-foreground overflow-hidden">
        <div className="w-80 flex-shrink-0 flex flex-col min-h-0 bg-content1 dark:bg-surface-sidebar">
          <ChatNav activePanel={activePanel} onSelectPanel={setActivePanel} />

          <div className="h-px bg-divider" />

          <ChatList
            activeRecipient={activeRecipient}
            displayName={displayName}
            hasContact={hasContact}
            recipients={recipients}
            onEditContact={setEditingRecipient}
            onNewChat={startNewChat}
            onSelectRecipient={setActiveRecipient}
          />

          <ChatProfile />
        </div>

        <div className="w-px flex-shrink-0 bg-default-200 dark:bg-surface-border" />

        <div className="relative flex flex-col flex-grow min-h-0">
          <ChatThread
            activeRecipient={activeRecipient}
            callingRecipient={callingRecipient}
            canSend={canSend}
            displayName={displayName}
            draftRecipient={draftRecipient}
            hasContact={hasContact}
            isSending={isSending}
            messageText={messageText}
            messages={activeMessages}
            recipients={recipients.map(([recipient]) => recipient)}
            onDraftRecipientChange={setDraftRecipient}
            onEditContact={setEditingRecipient}
            onEndCall={() => setCallingRecipient(null)}
            onMessageTextChange={setMessageText}
            onSelectRecipient={setActiveRecipient}
            onSend={handleSend}
            onStartCall={setCallingRecipient}
          />

          {activePanel && panelMeta && (
            <AppPanel
              icon={panelMeta.icon}
              title={panelMeta.label}
              onClose={() => setActivePanel(null)}
            >
              {activePanel === "game-servers" ? (
                <GameServersPanel />
              ) : (
                <CommunitiesPanel />
              )}
            </AppPanel>
          )}
        </div>
      </div>

      <ContactModal
        currentName={
          editingRecipient && hasContact(editingRecipient)
            ? displayName(editingRecipient)
            : ""
        }
        isOpen={editingRecipient !== null}
        phoneNumber={editingRecipient ?? ""}
        onClose={() => setEditingRecipient(null)}
        onSave={saveContact}
      />
    </>
  );
}
