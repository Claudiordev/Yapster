"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";

import { SettingsPanel } from "@/app/(protected)/settings/_Components/SettingsPanel";
import { Icon, type IconName } from "@/components/Icon/Icon";
import { siteConfig } from "@/config/site";
import { FEATURE_OAUTH2_LOGIN } from "@/lib/constants";
import { useAccount } from "@/lib/hooks/useAccount";
import { POPUP_MOTION_PROPS } from "@/lib/popupMotion";
import { readProblemDetail } from "@/lib/problemDetails";
import type { LinkedProvider } from "@/types/user";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Mirrors the session service's @Size(min = 8) on the new password. */
const MIN_PASSWORD_LENGTH = 8;

/** Mirrors the session service's @Size(min = 3, max = 30) on the new username. */
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

/** Left-menu icon size, shared by the tabs and Log out. */
const NAV_ICON_SIZE = 20;

type TabId = "audio-video" | "language" | "account" | "linked" | "payments" | "payouts" | "about";

interface Tab {
  id: TabId;
  label: string;
  icon: IconName;
}

const USER_TABS: Tab[] = [
  { id: "account", label: "Account", icon: "user" },
  { id: "linked", label: "Linked Accounts", icon: "users" },
];

const APP_TABS: Tab[] = [
  { id: "audio-video", label: "Audio and Video", icon: "mic-outline" },
  { id: "language", label: "Language", icon: "globe" },
];

const BILLING_TABS: Tab[] = [
  { id: "payments", label: "Payments", icon: "card" },
  { id: "payouts", label: "Payouts", icon: "dollar" },
];

const ABOUT_TAB: Tab = { id: "about", label: "About", icon: "info" };

function PasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirmPassword !== "" && confirmPassword !== newPassword;
  const tooShort = newPassword !== "" && newPassword.length < MIN_PASSWORD_LENGTH;
  const canSave =
    currentPassword !== "" &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword;

  function handleClose() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    onClose();
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        setError(await readProblemDetail(res, "Could not change your password."));

        return;
      }

      addToast({ title: "Password updated" });
      handleClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{
        backdrop: "bg-black/70 backdrop-blur-2xl backdrop-saturate-50",
        base: "start-card",
        closeButton: "right-4 top-4 rounded-full border border-white/15",
      }}
      isOpen={isOpen}
      size="md"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex-col items-center gap-0 px-7 pt-7 pb-0 text-center">
          <h2 className="text-[25px] font-bold tracking-tight text-foreground">
            Change password
          </h2>
          <p className="mt-2 text-sm font-normal text-default-500">
            Enter your current password and new one
          </p>
        </ModalHeader>
        <ModalBody className="gap-4 px-7 pt-4">
          <Input
            classNames={{ inputWrapper: "h-11 border-[#46424d] bg-[#18191d]" }}
            label="Current password"
            labelPlacement="outside"
            placeholder="Current password"
            type="password"
            value={currentPassword}
            variant="bordered"
            onValueChange={setCurrentPassword}
          />
          <Input
            classNames={{ inputWrapper: "h-11 border-[#46424d] bg-[#18191d]" }}
            errorMessage={`Use at least ${MIN_PASSWORD_LENGTH} characters`}
            isInvalid={tooShort}
            label="New password"
            labelPlacement="outside"
            placeholder="New password"
            type="password"
            value={newPassword}
            variant="bordered"
            onValueChange={setNewPassword}
          />
          <Input
            classNames={{ inputWrapper: "h-11 border-[#46424d] bg-[#18191d]" }}
            errorMessage="Passwords don't match"
            isInvalid={mismatch}
            label="Confirm new password"
            labelPlacement="outside"
            placeholder="Confirm new password"
            type="password"
            value={confirmPassword}
            variant="bordered"
            onValueChange={setConfirmPassword}
          />
          {error && <p className="text-small text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter className="mx-7 mb-2 mt-2 flex-col items-stretch gap-4 border-t border-white/10 px-0 pt-4">
          <div className="grid grid-cols-[1fr_1.4fr] gap-2.5">
            <Button
              className="min-h-11 rounded-[10px] border border-[#4b4652] bg-[#34343b] text-sm font-bold shadow-[0_3px_0_#1a191f]"
              variant="flat"
              onPress={handleClose}
            >
              Cancel
            </Button>
            <Button
              className="btn-coral min-h-11 rounded-[10px] text-sm font-bold"
              isDisabled={!canSave}
              isLoading={saving}
              onPress={save}
            >
              Update password
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function UsernameModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { username, refresh } = useAccount();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const tooShort = trimmed !== "" && trimmed.length < MIN_USERNAME_LENGTH;
  const canSave =
    trimmed.length >= MIN_USERNAME_LENGTH &&
    trimmed.length <= MAX_USERNAME_LENGTH &&
    trimmed !== username;

  // Start from the current name each time it opens.
  useEffect(() => {
    if (isOpen) {
      setValue(username ?? "");
      setError(null);
    }
  }, [isOpen, username]);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/user/username", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername: trimmed }),
      });

      if (!res.ok) {
        setError(await readProblemDetail(res, "Could not change your username."));

        return;
      }

      await refresh();
      addToast({ title: "Username updated" });
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{
        backdrop: "bg-black/70 backdrop-blur-2xl backdrop-saturate-50",
        base: "start-card",
        closeButton: "right-4 top-4 rounded-full border border-white/15",
      }}
      isOpen={isOpen}
      size="md"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex-col items-center gap-0 px-7 pt-7 pb-0 text-center">
          <h2 className="text-[25px] font-bold tracking-tight text-foreground">
            Change username
          </h2>
          <p className="mt-2 text-sm font-normal text-default-500">
            Pick the name other people see
          </p>
        </ModalHeader>
        <ModalBody className="gap-4 px-7 pt-4">
          <Input
            autoFocus
            classNames={{ inputWrapper: "h-11 border-[#46424d] bg-[#18191d]" }}
            errorMessage={`Use at least ${MIN_USERNAME_LENGTH} characters`}
            isInvalid={tooShort}
            label="Username"
            labelPlacement="outside"
            maxLength={MAX_USERNAME_LENGTH}
            placeholder="Username"
            value={value}
            variant="bordered"
            onKeyDown={(event) => {
              if (event.key === "Enter" && canSave && !saving) void save();
            }}
            onValueChange={setValue}
          />
          {error && <p className="text-small text-danger">{error}</p>}
        </ModalBody>
        <ModalFooter className="mx-7 mb-2 mt-2 flex-col items-stretch gap-4 border-t border-white/10 px-0 pt-4">
          <div className="grid grid-cols-[1fr_1.4fr] gap-2.5">
            <Button
              className="min-h-11 rounded-[10px] border border-[#4b4652] bg-[#34343b] text-sm font-bold shadow-[0_3px_0_#1a191f]"
              variant="flat"
              onPress={onClose}
            >
              Cancel
            </Button>
            <Button
              className="btn-coral min-h-11 rounded-[10px] text-sm font-bold"
              isDisabled={!canSave}
              isLoading={saving}
              onPress={save}
            >
              Update username
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function LogoutModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { logout } = useAccount();
  const [loggingOut, setLoggingOut] = useState(false);

  async function confirm() {
    setLoggingOut(true);

    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{
        backdrop: "bg-black/70 backdrop-blur-2xl backdrop-saturate-50",
        base: "start-card",
        closeButton: "right-4 top-4 rounded-full border border-white/15",
      }}
      isOpen={isOpen}
      size="sm"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="flex-col items-center gap-0 px-7 pt-7 pb-0 text-center">
          <h2 className="text-[25px] font-bold tracking-tight text-foreground">
            Log out?
          </h2>
          <p className="mt-2 text-sm font-normal text-default-500">
            Are you sure you want to be logged out?
          </p>
        </ModalHeader>
        <ModalFooter className="mx-7 mb-2 mt-4 flex-col items-stretch gap-4 border-t border-white/10 px-0 pt-4">
          <div className="grid grid-cols-[1fr_1.4fr] gap-2.5">
            <Button
              autoFocus
              className="min-h-11 rounded-[10px] border border-[#4b4652] bg-[#34343b] text-sm font-bold shadow-[0_3px_0_#1a191f]"
              variant="flat"
              onPress={onClose}
            >
              Cancel
            </Button>
            <Button
              className="btn-coral min-h-11 rounded-[10px] text-sm font-bold"
              isLoading={loggingOut}
              onPress={confirm}
            >
              Log out
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function AccountTab() {
  const { username } = useAccount();
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-medium font-semibold text-foreground">Account</h2>
      <div className="h-px bg-divider" />
      <div className="flex items-center justify-between gap-4">
        <h3 className="flex-shrink-0 text-sm font-semibold text-foreground">Username</h3>
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm text-default-500">{username}</span>
          <Button
            className="flex-shrink-0"
            size="sm"
            variant="flat"
            onPress={() => setUsernameOpen(true)}
          >
            Edit
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Password</h3>
          <p className="text-tiny text-default-500">
            Change the password you use to sign in.
          </p>
        </div>
        <Button
          className="flex-shrink-0"
          size="sm"
          variant="flat"
          onPress={() => setOpen(true)}
        >
          Edit
        </Button>
      </div>
      <UsernameModal isOpen={usernameOpen} onClose={() => setUsernameOpen(false)} />
      <PasswordModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function LinkedAccountsTab() {
  const [providers, setProviders] = useState<LinkedProvider[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const google = providers?.find((entry) => entry.provider === "google");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/providers", { cache: "no-store" });

      if (!res.ok) throw new Error("load failed");

      setProviders((await res.json()) as LinkedProvider[]);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function unlink() {
    setUnlinking(true);

    try {
      const res = await fetch("/api/user/providers/google", { method: "DELETE" });

      if (!res.ok) {
        addToast({
          title: await readProblemDetail(res, "Could not unlink Google."),
          color: "danger",
        });

        return;
      }

      addToast({ title: "Google account unlinked" });
      setConfirmOpen(false);
      await load();
    } catch {
      addToast({ title: "Could not unlink Google.", color: "danger" });
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-medium font-semibold text-foreground">
        Linked Accounts
      </h2>
      <div className="h-px bg-divider" />

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="flex-shrink-0" height={24} src="/icons/google.svg" width={24} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Google</h3>
            <p className="truncate text-tiny text-default-500">
              {failed
                ? "Couldn't load your linked accounts."
                : providers === null
                  ? "Loading…"
                  : google
                    ? `Linked${google.email ? ` as ${google.email}` : ""}`
                    : "Sign in with your Google account."}
            </p>
          </div>
        </div>

        {failed ? (
          <Button className="flex-shrink-0" size="sm" variant="flat" onPress={() => void load()}>
            Retry
          </Button>
        ) : google ? (
          <Button
            className="flex-shrink-0"
            color="danger"
            size="sm"
            variant="flat"
            onPress={() => setConfirmOpen(true)}
          >
            Unlink
          </Button>
        ) : providers !== null && FEATURE_OAUTH2_LOGIN ? (
          <Button
            as="a"
            className="flex-shrink-0"
            href={`/api/auth/google/start?link=1&next=${encodeURIComponent("/message")}`}
            size="sm"
            variant="flat"
          >
            Link
          </Button>
        ) : null}
      </div>

      <Modal
        backdrop="blur"
        classNames={{
          backdrop: "bg-black/70 backdrop-blur-2xl backdrop-saturate-50",
          base: "start-card",
          closeButton: "right-4 top-4 rounded-full border border-white/15",
        }}
        isOpen={confirmOpen}
        size="sm"
        onClose={() => setConfirmOpen(false)}
      >
        <ModalContent>
          <ModalHeader className="flex-col items-center gap-0 px-7 pt-7 pb-0 text-center">
            <h2 className="text-[25px] font-bold tracking-tight text-foreground">
              Unlink Google?
            </h2>
            <p className="mt-2 text-sm font-normal text-default-500">
              You won&apos;t be able to sign in with Google until you link it again.
            </p>
          </ModalHeader>
          <ModalFooter className="mx-7 mb-2 mt-4 flex-col items-stretch gap-4 border-t border-white/10 px-0 pt-4">
            <div className="grid grid-cols-[1fr_1.4fr] gap-2.5">
              <Button
                autoFocus
                className="min-h-11 rounded-[10px] border border-[#4b4652] bg-[#34343b] text-sm font-bold shadow-[0_3px_0_#1a191f]"
                variant="flat"
                onPress={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="btn-coral min-h-11 rounded-[10px] text-sm font-bold"
                isLoading={unlinking}
                onPress={unlink}
              >
                Unlink
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function NavButton({
  tab,
  active,
  onSelect,
}: {
  tab: Tab;
  active: boolean;
  onSelect: (id: TabId) => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-medium px-3 py-2 text-left text-sm font-medium transition-colors ${
        active ? "bg-brand/15 text-foreground" : "text-default-500 hover:bg-default-100"
      }`}
      type="button"
      onClick={() => onSelect(tab.id)}
    >
      <Icon
        className={active ? "text-brand" : undefined}
        name={tab.icon}
        size={NAV_ICON_SIZE}
      />
      {tab.label}
    </button>
  );
}

/** Languages the app is translated into. Only English exists so far. */
const LANGUAGES = [{ id: "en", label: "English" }];

function LanguageTab() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-medium font-semibold text-foreground">Language</h2>
      <div className="h-px bg-divider" />
      <div className="flex items-center gap-3 rounded-medium bg-content2 p-3 text-foreground">
        <Icon name="globe" size={24} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">Display language</span>
          <span className="text-tiny text-default-500">
            Choose the language the app is shown in
          </span>
        </div>
        <Select
          aria-label="Display language"
          className="w-40 flex-shrink-0"
          popoverProps={{ motionProps: POPUP_MOTION_PROPS }}
          selectedKeys={["en"]}
          size="sm"
          variant="bordered"
        >
          {LANGUAGES.map((language) => (
            <SelectItem key={language.id}>{language.label}</SelectItem>
          ))}
        </Select>
      </div>
    </div>
  );
}

/** Empty page for a billing tab until its backend exists. */
function BillingPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-medium font-semibold text-foreground">{title}</h2>
      <div className="h-px bg-divider" />
      <p className="text-sm text-default-500">{description}</p>
    </div>
  );
}

function AboutLink({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: IconName;
}) {
  return (
    <a
      className="flex items-center gap-3 rounded-medium bg-content2 p-3 text-foreground transition-colors hover:bg-content3"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Icon name={icon} size={24} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-tiny text-default-500">{description}</span>
      </div>
      <Icon className="text-default-500" name="external-link" size={16} />
    </a>
  );
}

function AboutTab() {
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-medium font-semibold text-foreground">About</h2>
      <div className="h-px bg-divider" />

      <div className="flex flex-col items-center gap-2 text-center">
        <Image
          alt=""
          className="rounded-[18px]"
          height={80}
          src="/images/voxsi-logo.png"
          width={80}
        />
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {siteConfig.name}
        </h2>
        <p className="max-w-xs text-sm text-default-500">
          Chat, call compete, all in one place
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <AboutLink
          description="Browse the code, or contribute"
          href={siteConfig.links.github}
          icon="github"
          title="Open source"
        />
        <AboutLink
          description="Help us improving by reporting issues"
          href={`${siteConfig.links.github}/issues`}
          icon="warning"
          title="Report a bug"
        />
      </div>
    </div>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { isFeatureEnabled } = useAccount();
  const billingEnabled = isFeatureEnabled("billing");
  const [selected, setTab] = useState<TabId>("audio-video");
  // A billing page is only reachable while the feature is on.
  const tab: TabId =
    !billingEnabled && BILLING_TABS.some((entry) => entry.id === selected)
      ? "audio-video"
      : selected;
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <Modal
      backdrop="blur"
      classNames={{ base: "h-[80vh] max-h-[720px]" }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="4xl"
      onClose={onClose}
    >
      <ModalContent>
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Settings"
            className="flex w-44 flex-shrink-0 flex-col gap-1 border-r border-divider p-3 pt-6"
          >
            {[
              { heading: "User settings", tabs: USER_TABS },
              { heading: "App settings", tabs: APP_TABS },
              ...(billingEnabled ? [{ heading: "Billing", tabs: BILLING_TABS }] : []),
            ].map(({ heading, tabs }) => (
              <Fragment key={heading}>
                <h2 className="px-3 pb-1 pt-2 text-tiny font-semibold uppercase tracking-wide text-default-500">
                  {heading}
                </h2>
                <div className="mb-1 h-px bg-divider" />
                {tabs.map((entry) => (
                  <NavButton
                    key={entry.id}
                    active={tab === entry.id}
                    tab={entry}
                    onSelect={setTab}
                  />
                ))}
              </Fragment>
            ))}

            {/* About and Log out are pinned to the bottom, with a divider between them. */}
            <div className="mt-auto" />
            <NavButton active={tab === ABOUT_TAB.id} tab={ABOUT_TAB} onSelect={setTab} />

            <div className="my-1 h-px bg-divider" />

            {/* Not a tab: opens a confirmation. Same red as the old profile-bar logout key. */}
            <button
              className="chat-profile-logout flex items-center gap-2.5 rounded-medium px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-default-100"
              type="button"
              onClick={() => setLogoutOpen(true)}
            >
              <Icon name="logout" size={NAV_ICON_SIZE} />
              Log out
            </button>
          </nav>

          <ModalBody className="min-h-0 flex-1 overflow-y-auto py-6">
            {tab === "audio-video" && <SettingsPanel />}
            {tab === "account" && <AccountTab />}
            {tab === "linked" && <LinkedAccountsTab />}
            {tab === "language" && <LanguageTab />}
            {tab === "payments" && (
              <BillingPlaceholder
                description="Your payments will show up here."
                title="Payments"
              />
            )}
            {tab === "payouts" && (
              <BillingPlaceholder
                description="Your payouts will show up here."
                title="Payouts"
              />
            )}
            {tab === "about" && <AboutTab />}
          </ModalBody>
        </div>
        <LogoutModal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
      </ModalContent>
    </Modal>
  );
}
