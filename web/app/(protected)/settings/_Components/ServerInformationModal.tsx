"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Spinner } from "@heroui/spinner";

import { Icon } from "@/components/icon";
import { readProblemDetail } from "@/lib/problem-details";

interface ServerInformation {
  onlineUsers: number;
  onlineDevices: number;
}

interface ServerInformationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const rows: Array<{ key: keyof ServerInformation; label: string }> = [
  { key: "onlineUsers", label: "Online users" },
  { key: "onlineDevices", label: "Online devices" },
];

export function ServerInformationModal({
  isOpen,
  onClose,
}: ServerInformationModalProps) {
  const [information, setInformation] = useState<ServerInformation | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/monitor", {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(
          await readProblemDetail(
            response,
            "Could not load server information.",
          ),
        );
      }

      setInformation((await response.json()) as ServerInformation);
    } catch (loadError) {
      if (
        loadError instanceof DOMException &&
        loadError.name === "AbortError"
      ) {
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load server information.",
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    load(controller.signal);

    return () => controller.abort();
  }, [isOpen, load]);

  return (
    <Modal backdrop="blur" isOpen={isOpen} size="sm" onClose={onClose}>
      <ModalContent>
        <ModalHeader>Server information</ModalHeader>
        <Button
          isIconOnly
          aria-label="Refresh server information"
          className="absolute right-10 top-2"
          isDisabled={isLoading}
          size="sm"
          variant="light"
          onPress={() => load()}
        >
          <Icon
            className={isLoading ? "animate-spin" : undefined}
            name="refresh"
            size={17}
          />
        </Button>
        <ModalBody className="gap-0 pb-2">
          {isLoading && !information ? (
            <div className="flex min-h-28 items-center justify-center">
              <Spinner label="Loading server information" size="sm" />
            </div>
          ) : error ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-danger">{error}</p>
              <Button size="sm" variant="flat" onPress={() => load()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-medium border border-divider">
              {rows.map(({ key, label }, index) => (
                <div
                  key={key}
                  className={`flex items-center justify-between px-4 py-3 ${
                    index === 0 ? "" : "border-t border-divider"
                  }`}
                >
                  <span className="text-sm text-default-500">{label}</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {information?.[key] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
