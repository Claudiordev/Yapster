"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";

import { Icon } from "@/components/Icon/Icon";
import { RoleBadge } from "@/components/RoleBadge/RoleBadge";
import { useAccount } from "@/lib/hooks/useAccount";
import { readProblemDetail } from "@/lib/problemDetails";
import { badgesForRoles } from "@/lib/roleBadges";
import type { UserProfileData } from "@/types/user";

const MAX_BIO_LENGTH = 500;
/** The session service rejects uploads over 2MB. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Your own profile: click the picture to choose a new one (it uploads right away)
 * and edit the "About me" text. Opened from the profile card.
 */
export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { userId, username, avatarUrl, roles, refresh } = useAccount();
  const fileInput = useRef<HTMLInputElement>(null);
  const [savedBio, setSavedBio] = useState("");
  const [bio, setBio] = useState("");
  const [loadingBio, setLoadingBio] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the current bio each time the modal opens.
  useEffect(() => {
    if (!isOpen || !userId) return;

    const controller = new AbortController();

    setLoadingBio(true);
    setError(null);
    fetch(`/api/users/${encodeURIComponent(userId)}`, { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<UserProfileData>) : Promise.reject()))
      .then((profile) => {
        setSavedBio(profile.bio ?? "");
        setBio(profile.bio ?? "");
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load your bio.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBio(false);
      });

    return () => controller.abort();
  }, [isOpen, userId]);

  async function handlePicture(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = ""; // allow choosing the same file again
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");

      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("That image is over 2MB. Please choose a smaller one.");

      return;
    }

    setUploading(true);
    setError(null);

    try {
      const body = new FormData();

      // The backend expects the multipart field named "file".
      body.append("file", file);

      const res = await fetch("/api/user/avatar", { method: "POST", body });

      if (!res.ok) {
        setError(await readProblemDetail(res, "Upload failed"));

        return;
      }

      await refresh();
      addToast({ title: "Profile picture updated" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function saveBio() {
    setSavingBio(true);
    setError(null);

    try {
      const res = await fetch("/api/user/bio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
      });

      if (!res.ok) {
        setError(await readProblemDetail(res, "Could not save your bio."));

        return;
      }

      setSavedBio(bio.trim());
      setBio(bio.trim());
      addToast({ title: "Bio saved" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSavingBio(false);
    }
  }

  const badges = badgesForRoles(roles);
  const changed = bio.trim() !== savedBio;
  const tooLong = bio.length > MAX_BIO_LENGTH;

  return (
    <Modal backdrop="blur" isOpen={isOpen} scrollBehavior="inside" size="sm" onClose={onClose}>
      <ModalContent>
        <ModalBody className="gap-0 p-0">
          <div className="h-20 w-full rounded-t-large bg-gradient-to-br from-brand to-brand-deep" />

          <div className="flex flex-col items-center px-5 pb-5 -mt-10">
            <button
              aria-label="Change profile picture"
              className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand"
              disabled={uploading}
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              <Avatar
                className="h-20 w-20 bg-default-200 text-brand text-2xl ring-4 ring-content1"
                name={(username ?? "U").charAt(0).toUpperCase()}
                src={avatarUrl ?? undefined}
              />
              <span
                className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white transition-opacity ${
                  uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                }`}
              >
                {uploading ? <Spinner color="white" size="sm" /> : <Icon name="edit" size={20} />}
              </span>
            </button>
            <input
              ref={fileInput}
              accept="image/*"
              className="hidden"
              type="file"
              onChange={handlePicture}
            />
            <p className="mt-1 text-tiny text-default-400">Click the picture to change it</p>

            <p className="mt-2 text-lg font-semibold text-foreground">{username ?? "…"}</p>

            {badges.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {badges.map((badge) => (
                  <RoleBadge key={badge.role} badge={badge} />
                ))}
              </div>
            )}

            <div className="mt-4 w-full">
              <Textarea
                isDisabled={loadingBio}
                isInvalid={tooLong}
                label="About me"
                labelPlacement="outside"
                maxRows={6}
                minRows={3}
                placeholder="Tell people a bit about yourself"
                value={bio}
                variant="bordered"
                onValueChange={setBio}
              />
              <p className={`mt-1 text-right text-tiny tabular-nums ${tooLong ? "text-danger" : "text-default-400"}`}>
                {bio.length}/{MAX_BIO_LENGTH}
              </p>
            </div>

            {error && (
              <div className="mt-2 w-full rounded-medium bg-danger/10 px-3 py-2 text-small text-danger">
                {error}
              </div>
            )}

            <div className="mt-4 flex w-full justify-end gap-2">
              <Button variant="light" onPress={onClose}>
                Close
              </Button>
              <Button
                className="bg-brand text-white hover:bg-brand-hover"
                isDisabled={!changed || tooLong || loadingBio}
                isLoading={savingBio}
                onPress={saveBio}
              >
                Save
              </Button>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
