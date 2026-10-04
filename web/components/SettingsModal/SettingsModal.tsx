"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";

import { SettingsPanel } from "@/app/(protected)/settings/_Components/SettingsPanel";
import { Icon } from "@/components/Icon/Icon";
import { useAccount } from "@/lib/hooks/useAccount";
import { readProblemDetail } from "@/lib/problemDetails";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Mirrors the session service's @Size(min = 8) on the new password. */
const MIN_PASSWORD_LENGTH = 8;

type TabId = "general" | "account" | "linked";

const TABS: { id: TabId; label: string; icon: "settings" | "user" | "users" }[] = [
  { id: "general", label: "General", icon: "settings" },
  { id: "account", label: "Account", icon: "user" },
  { id: "linked", label: "Linked Accounts", icon: "users" },
];

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
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-medium font-semibold text-foreground">Account</h2>
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
      <PasswordModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function LinkedAccountsTab() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-medium font-semibold text-foreground">
        Linked Accounts
      </h2>
      <p className="rounded-large bg-content2 p-4 text-sm text-default-500">
        No linked accounts yet.
      </p>
    </div>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<TabId>("general");
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
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                aria-current={tab === id ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-medium px-3 py-2 text-left text-sm font-medium transition-colors ${
                  tab === id
                    ? "bg-brand/15 text-foreground"
                    : "text-default-500 hover:bg-default-100"
                }`}
                type="button"
                onClick={() => setTab(id)}
              >
                <Icon
                  className={tab === id ? "text-brand" : undefined}
                  name={icon}
                  size={16}
                />
                {label}
              </button>
            ))}

            {/* Not a tab: opens a confirmation. Same red as the old profile-bar logout key. */}
            <button
              className="chat-profile-logout mt-auto flex items-center gap-2.5 rounded-medium px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-default-100"
              type="button"
              onClick={() => setLogoutOpen(true)}
            >
              <Icon name="logout" size={16} />
              Log out
            </button>
          </nav>

          <ModalBody className="min-h-0 flex-1 overflow-y-auto py-6">
            {tab === "general" && <SettingsPanel />}
            {tab === "account" && <AccountTab />}
            {tab === "linked" && <LinkedAccountsTab />}
          </ModalBody>
        </div>
        <LogoutModal isOpen={logoutOpen} onClose={() => setLogoutOpen(false)} />
      </ModalContent>
    </Modal>
  );
}
