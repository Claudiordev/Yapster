"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { Switch } from "@heroui/switch";
import { addToast } from "@heroui/toast";

import { useAccount } from "@/lib/hooks/useAccount";
import { readProblemDetail } from "@/lib/problemDetails";
import type { FeatureFlags } from "@/types/user";

/** Display names for the flags the backend knows; an unknown flag falls back to its raw name. */
const FEATURE_LABELS: Record<string, string> = {
  "game-servers": "Game servers",
  events: "Events",
  premium: "Premium",
  gif: "GIF button",
};

interface FeatureFlagsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Admin-only: switch menu features on or off. Each toggle saves straight away with a PUT.
 * Other users see the change the next time they load the app (flags are read at login).
 */
export function FeatureFlagsModal({ isOpen, onClose }: FeatureFlagsModalProps) {
  const { features, setFeatures } = useAccount();
  const [saving, setSaving] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function addFeature() {
    const name = newName.trim();

    if (!name) return;
    setAdding(true);

    try {
      const res = await fetch("/api/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled: false }),
      });

      if (!res.ok) {
        addToast({
          color: "danger",
          title: "Could not add feature",
          description: await readProblemDetail(res, "Use lower-case words joined by dashes, e.g. leaderboard."),
        });

        return;
      }

      setFeatures((await res.json()) as FeatureFlags);
      setNewName("");
    } catch {
      addToast({ color: "danger", title: "Could not add feature" });
    } finally {
      setAdding(false);
    }
  }

  async function toggle(name: string, enabled: boolean) {
    setSaving(name);

    try {
      const res = await fetch("/api/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [name]: enabled }),
      });

      if (!res.ok) {
        addToast({ color: "danger", title: "Could not update feature", description: await readProblemDetail(res, "Please try again.") });

        return;
      }

      setFeatures((await res.json()) as FeatureFlags);
    } catch {
      addToast({ color: "danger", title: "Could not update feature" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <Modal isOpen={isOpen} placement="center" onClose={onClose}>
      <ModalContent>
        <ModalHeader>Features</ModalHeader>
        <ModalBody className="pb-6">
          <p className="text-tiny text-default-500">
            Switched-off features show as disabled in the menu. Users see a change the next time they load the app.
          </p>
          {Object.keys(features)
            .sort()
            .map((name) => (
              <Switch
                key={name}
                isDisabled={saving === name}
                isSelected={features[name]}
                size="sm"
                onValueChange={(enabled) => void toggle(name, enabled)}
              >
                {FEATURE_LABELS[name] ?? name}
              </Switch>
            ))}
          <div className="flex items-end gap-2 pt-2">
            <Input
              label="New feature"
              labelPlacement="outside"
              placeholder="e.g. leaderboard"
              size="sm"
              value={newName}
              variant="bordered"
              onKeyDown={(event) => {
                if (event.key === "Enter") void addFeature();
              }}
              onValueChange={setNewName}
            />
            <Button
              isDisabled={!newName.trim()}
              isLoading={adding}
              size="sm"
              variant="flat"
              onPress={() => void addFeature()}
            >
              Add
            </Button>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
