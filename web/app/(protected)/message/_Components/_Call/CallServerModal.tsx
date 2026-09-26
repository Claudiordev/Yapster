"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";

import { changeCallRegion, fetchCallRegions } from "@/lib/callRegions";
import type { CallRegion } from "@/types/call";

interface CallServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The conversation id the call runs in (also the voice room name). */
  conversationId: string | null;
  /** Called after the switch succeeded (everyone is then moved by CALL_REGION_CHANGED). */
  onSwitched?: (region: CallRegion) => void;
}

/**
 * NOT RENDERED for now: server switching is disabled until the voice service
 * has the regions API (the latency badge is no longer clickable).
 *
 * Server picker for the call: lists the regions the voice service offers and
 * moves the WHOLE call (everyone in it) to the one you choose.
 */
export function CallServerModal({
  isOpen,
  onClose,
  conversationId,
  onSwitched,
}: CallServerModalProps) {
  const [regions, setRegions] = useState<CallRegion[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !conversationId) return;

    const controller = new AbortController();

    setLoading(true);
    setError(null);
    fetchCallRegions(conversationId, controller.signal)
      .then((data) => {
        setRegions(data.regions);
        setCurrent(data.current);
        setSelected(data.current);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Could not load the servers.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, conversationId]);

  async function save() {
    const region = regions.find((r) => r.id === selected);

    if (!conversationId || !region || region.id === current) return;

    setSaving(true);
    setError(null);

    try {
      await changeCallRegion(conversationId, region.id);
      setCurrent(region.id);
      addToast({ title: `Moving the call to ${region.name}…` });
      onSwitched?.(region);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the server.");
    } finally {
      setSaving(false);
    }
  }

  const changed = selected !== null && selected !== current;

  return (
    <Modal backdrop="blur" isOpen={isOpen} size="md" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Call server
          <span className="text-tiny font-normal text-default-500">
            Everyone in the call is moved to the server you pick.
          </span>
        </ModalHeader>

        <ModalBody className="gap-2">
          {loading && (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          )}

          {!loading && (
            <ul aria-label="Servers" className="flex flex-col gap-2" role="radiogroup">
              {regions.map((region) => {
                const isSelected = selected === region.id;

                return (
                  <li key={region.id}>
                    <button
                      aria-checked={isSelected}
                      className={`flex w-full items-center gap-3 rounded-medium border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-brand bg-brand/10"
                          : "border-divider hover:bg-content2"
                      }`}
                      role="radio"
                      type="button"
                      onClick={() => setSelected(region.id)}
                    >
                      <span aria-hidden className="text-2xl leading-none">
                        {region.flag ?? "🌐"}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-small font-semibold text-foreground">
                          {region.name}
                        </span>
                        {region.latencyMs != null && (
                          <span className="text-tiny text-default-500">
                            {region.latencyMs} ms
                          </span>
                        )}
                      </span>
                      {region.id === current && (
                        <Chip color="success" size="sm" variant="flat">
                          Current
                        </Chip>
                      )}
                    </button>
                  </li>
                );
              })}

              {regions.length === 0 && !error && (
                <li className="py-4 text-center text-small text-default-500">
                  No servers available.
                </li>
              )}
            </ul>
          )}

          {error && (
            <div className="rounded-medium bg-danger/10 px-3 py-2 text-small text-danger">
              {error}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            isDisabled={!changed || loading}
            isLoading={saving}
            onPress={save}
          >
            Switch server
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
