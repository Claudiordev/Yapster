"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";

import { SendIcon } from "./send-icon";

interface ChatMessage {
  id: string;
  body: string;
  to: string;
  status: string;
  pending: boolean;
  error?: string;
  dateSent?: string;
  price?: string;
  priceUnit?: string;
}

function statusColor(status: string) {
  switch (status) {
    case "delivered":
    case "sent":
      return "success" as const;
    case "failed":
      return "danger" as const;
    default:
      return "warning" as const;
  }
}

export function SmsPanel() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!messageText.trim() || !phoneNumber.trim()) return;

    const tempId = crypto.randomUUID();
    const body = messageText.trim();

    const optimistic: ChatMessage = {
      id: tempId,
      body,
      to: phoneNumber,
      status: "sending",
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setMessageText("");
    setIsSending(true);

    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver: phoneNumber, message: body }),
      });

      if (!res.ok) {
        const data = await res.json();

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  pending: false,
                  status: "failed",
                  error: data.error || "Send failed",
                }
              : m,
          ),
        );

        return;
      }

      const data = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                pending: false,
                status: data.status || "queued",
                dateSent: data.date_sent,
                price: data.price,
                priceUnit: data.price_unit,
              }
            : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                pending: false,
                status: "failed",
                error: "Network error. Please try again.",
              }
            : m,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-col flex-grow h-full gap-4">
      {/* Phone number input */}
      <div className="flex-shrink-0">
        <Input
          label="Recipient"
          labelPlacement="outside"
          placeholder="+1 (555) 123-4567"
          size="lg"
          startContent={
            <span className="text-default-400 text-sm">📞</span>
          }
          type="tel"
          value={phoneNumber}
          variant="bordered"
          onValueChange={setPhoneNumber}
        />
      </div>

      <Divider />

      {/* Message history */}
      <div className="flex-grow overflow-y-auto flex flex-col gap-3 px-1 min-h-0">
        {messages.length === 0 && (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-default-400 text-center text-sm">
              No messages yet. Enter a phone number and send a message.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[75%] flex flex-col items-end gap-1">
              <Card className="bg-primary-50 dark:bg-primary-100/10">
                <CardBody className="py-2 px-3">
                  <p className="text-sm">{msg.body}</p>
                </CardBody>
              </Card>
              {msg.error && (
                <span className="text-danger text-tiny">{msg.error}</span>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="flex-shrink-0">
        <Divider className="mb-3" />
        <Form className="flex flex-row gap-2 items-end" onSubmit={handleSend}>
          <Input
            className="flex-grow"
            isDisabled={!phoneNumber.trim()}
            name="message"
            placeholder="Type a message..."
            value={messageText}
            variant="bordered"
            onValueChange={setMessageText}
          />
          <Button
            aria-label="Send message"
            color="primary"
            isDisabled={!messageText.trim() || !phoneNumber.trim()}
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
