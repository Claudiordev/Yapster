"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";

import { ProfileCard } from "./ProfileCard";
import { BANNER_COLORS, DEFAULT_BANNER_COLOR } from "./utils/bannerColors";

import { Icon } from "@/components/Icon/Icon";
import { ToggleRow } from "@/components/OnOffToggle/OnOffToggle";
import { useAccount } from "@/lib/hooks/useAccount";
import { readProblemDetail } from "@/lib/problemDetails";
import type { ProfileDraft, UserProfileData } from "@/types/user";

const MAX_BIO_LENGTH = 500;
const MAX_PRONOUNS_LENGTH = 20;
const MAX_CUSTOM_STATUS_LENGTH = 100;
/** Same limit as the session service's AvatarImageProcessor (and the banner, once it exists). */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const EMPTY_DRAFT: ProfileDraft = {
  pronouns: "",
  customStatus: "",
  bio: "",
  bannerColor: DEFAULT_BANNER_COLOR,
  bannerImageUrl: null,
  showMemberSince: true,
};

/** Raised grey key, the same one the settings dialogs use for secondary actions. */
const SECONDARY_BUTTON =
  "min-h-10 rounded-[10px] border border-[#4b4652] bg-[#34343b] text-sm font-bold shadow-[0_3px_0_#1a191f]";

const INPUT_WRAPPER = "h-11 border-[#46424d] bg-[#18191d]";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Your own profile, in one modal opened from the profile bar: edit on the left, see the
 * card others get on the right.
 * Avatar and "About me" save to the session service today; pronouns,
 * custom status, banner and the member-since switch only change the preview until
 * the profile endpoints from docs/profile-edit-backend-plan.md exist.
 */
export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { userId, username, avatarUrl, roles, refresh } = useAccount();
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [savedBio, setSavedBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the current bio each time the modal opens.
  useEffect(() => {
    if (!isOpen || !userId) return;

    const controller = new AbortController();

    setLoading(true);
    setError(null);
    fetch(`/api/users/${encodeURIComponent(userId)}`, { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<UserProfileData>) : Promise.reject()))
      .then((profile) => {
        const bio = profile.bio ?? "";

        setSavedBio(bio);
        setDraft((current) => ({ ...current, bio }));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load your profile.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, userId]);

  // Free the banner preview URL when it is replaced or the page closes.
  useEffect(() => {
    const url = draft.bannerImageUrl;

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [draft.bannerImageUrl]);

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /** Checks a chosen image; returns it, or sets the error and returns null. */
  function pickImage(event: React.ChangeEvent<HTMLInputElement>): File | null {
    const file = event.target.files?.[0];

    event.target.value = ""; // allow choosing the same file again
    if (!file) return null;

    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Please choose a PNG, JPG or WebP image.");

      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is over 5 MB. Please choose a smaller one.");

      return null;
    }
    setError(null);

    return file;
  }

  async function handleAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = pickImage(event);

    if (!file) return;

    setUploadingAvatar(true);

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
      setUploadingAvatar(false);
    }
  }

  function handleBanner(event: React.ChangeEvent<HTMLInputElement>) {
    const file = pickImage(event);

    if (file) update("bannerImageUrl", URL.createObjectURL(file));
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/user/bio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: draft.bio }),
      });

      if (!res.ok) {
        setError(await readProblemDetail(res, "Could not save your profile."));

        return;
      }

      const bio = draft.bio.trim();

      setSavedBio(bio);
      update("bio", bio);
      addToast({ title: "Profile saved" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft({ ...EMPTY_DRAFT, bio: savedBio });
    setError(null);
  }

  const name = username ?? "…";
  const bioTooLong = draft.bio.length > MAX_BIO_LENGTH;
  const changed = draft.bio.trim() !== savedBio;

  return (
    <Modal
      backdrop="blur"
      classNames={{
        backdrop: "bg-black/70 backdrop-blur-2xl backdrop-saturate-50",
        base: "start-card overflow-hidden",
        closeButton: "right-4 top-4 rounded-full border border-white/15",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="5xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex-col items-start gap-0 border-b border-white/10 px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-brand">Your space</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Your profile</h2>
          <p className="mt-1 text-sm font-normal text-default-500">
            A little more you, wherever you show up.
          </p>
        </ModalHeader>

        <ModalBody className="gap-0 p-0">
      <div className="grid md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6 p-6 md:border-r md:border-white/10">
          <section className="flex flex-col gap-4">
            <h2 className="text-medium font-semibold text-foreground">Make an entrance</h2>

            <div className="flex items-center gap-4">
              <button
                aria-label="Change profile picture"
                className="group relative flex-shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand"
                disabled={uploadingAvatar}
                type="button"
                onClick={() => avatarInput.current?.click()}
              >
                <Avatar
                  className="h-20 w-20 bg-default-200 text-brand text-2xl"
                  name={name.charAt(0).toUpperCase()}
                  src={avatarUrl ?? undefined}
                />
                <span
                  className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white transition-opacity ${
                    uploadingAvatar
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  }`}
                >
                  {uploadingAvatar ? <Spinner color="white" size="sm" /> : <Icon name="edit" size={20} />}
                </span>
              </button>
              <input
                ref={avatarInput}
                accept={IMAGE_TYPES.join(",")}
                className="hidden"
                type="file"
                onChange={handleAvatar}
              />
              <div className="min-w-0 flex-grow">
                <p className="text-sm font-semibold text-foreground">Put a face to your voice.</p>
                <p className="text-tiny text-default-400">PNG, JPG or WebP · up to 5 MB</p>
              </div>
              <Button
                className={SECONDARY_BUTTON}
                isDisabled={uploadingAvatar}
                variant="flat"
                onPress={() => avatarInput.current?.click()}
              >
                Change avatar
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground">Banner color</p>
                <div className="mt-2 flex gap-2">
                  {BANNER_COLORS.map((color) => {
                    const selected = draft.bannerImageUrl === null && draft.bannerColor === color.id;

                    return (
                      <button
                        key={color.id}
                        aria-label={color.label}
                        aria-pressed={selected}
                        className={`flex h-7 w-7 items-center justify-center rounded-[4px] text-white ${color.className} ${
                          selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-content1" : ""
                        }`}
                        title={color.label}
                        type="button"
                        onClick={() => {
                          update("bannerColor", color.id);
                          update("bannerImageUrl", null);
                        }}
                      >
                        {selected && <Icon name="check" size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input
                ref={bannerInput}
                accept={IMAGE_TYPES.join(",")}
                className="hidden"
                type="file"
                onChange={handleBanner}
              />
              <Button
                className={SECONDARY_BUTTON}
                variant="flat"
                onPress={() => bannerInput.current?.click()}
              >
                Upload banner
              </Button>
            </div>
          </section>

          <hr className="border-white/10" />

          <section className="flex flex-col gap-4">
            <h2 className="text-medium font-semibold text-foreground">The basics</h2>

            <Input
              classNames={{ inputWrapper: INPUT_WRAPPER }}
              label="Pronouns"
              labelPlacement="outside"
              maxLength={MAX_PRONOUNS_LENGTH}
              placeholder="Add your pronouns"
              value={draft.pronouns}
              variant="bordered"
              onValueChange={(value) => update("pronouns", value)}
            />
            <p className="-mt-2 text-tiny text-default-400">
              Username <span className="font-semibold text-default-500">@{name}</span> · change it
              in Settings
            </p>

            <Input
              classNames={{ inputWrapper: INPUT_WRAPPER }}
              label="Custom status"
              labelPlacement="outside"
              maxLength={MAX_CUSTOM_STATUS_LENGTH}
              placeholder="What's on your mind?"
              value={draft.customStatus}
              variant="bordered"
              onValueChange={(value) => update("customStatus", value)}
            />

            <div>
              <Textarea
                classNames={{ inputWrapper: INPUT_WRAPPER }}
                isDisabled={loading}
                isInvalid={bioTooLong}
                label="About me"
                labelPlacement="outside"
                maxRows={8}
                minRows={4}
                placeholder="Tell people a bit about yourself"
                value={draft.bio}
                variant="bordered"
                onValueChange={(value) => update("bio", value)}
              />
              <div className="mt-1 flex justify-between text-tiny">
                <span className="text-default-400">A few words go a long way.</span>
                <span className={`tabular-nums ${bioTooLong ? "text-danger" : "text-default-400"}`}>
                  {draft.bio.length} / {MAX_BIO_LENGTH}
                </span>
              </div>
            </div>
          </section>

          <hr className="border-white/10" />

          <section className="flex flex-col gap-3">
            <h2 className="text-medium font-semibold text-foreground">What others can see</h2>
            <ToggleRow
              checked={draft.showMemberSince}
              description="Show when you joined Voxsi."
              label="Show member since"
              title="Member since"
              onChange={(value) => update("showMemberSince", value)}
            />
          </section>

          {error && (
            <div className="rounded-medium bg-danger/10 px-3 py-2 text-small text-danger">{error}</div>
          )}
        </div>

        <aside className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-default-400">
            <span>Live preview</span>
            <span className="flex items-center gap-1 normal-case tracking-normal font-normal">
              <Icon name="user" size={12} />
              As others see you
            </span>
          </div>
          <ProfileCard
            bannerColor={draft.bannerColor}
            bannerImageUrl={draft.bannerImageUrl}
            bio={draft.bio}
            customStatus={draft.customStatus}
            avatarUrl={avatarUrl}
            memberSince={null}
            name={name}
            pronouns={draft.pronouns}
            roles={roles}
            username={name}
          />
          <p className="text-tiny text-default-400">Your changes appear here as you edit.</p>
        </aside>
      </div>

        </ModalBody>

        <ModalFooter className="items-center justify-between gap-4 border-t border-white/10 px-6 py-4">
        <p className="text-tiny text-default-400">
          {changed ? "You have unsaved changes." : "All changes saved."}
        </p>
        <div className="grid w-72 grid-cols-2 gap-2.5">
          <Button
            className={`${SECONDARY_BUTTON} !h-10 !w-full !min-w-0 !px-0 !shadow-[0_4px_0_#1a191f] data-[disabled=true]:!shadow-[0_4px_0_#1a191f] active:!shadow-none`}
            isDisabled={!changed || saving}
            variant="flat"
            onPress={reset}
          >
            Reset
          </Button>
          <Button
            className="btn-coral !h-10 !w-full !min-w-0 !px-0 rounded-[10px] text-sm font-bold !shadow-[0_4px_0_var(--color-brand-deep)] data-[disabled=true]:!shadow-[0_4px_0_var(--color-brand-deep)] active:!shadow-none"
            isDisabled={!changed || bioTooLong || loading}
            isLoading={saving}
            onPress={save}
          >
            Save changes
          </Button>
        </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
