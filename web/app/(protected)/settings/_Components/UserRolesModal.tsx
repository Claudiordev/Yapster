"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";

import type { PlatformUser } from "@/types/user";
import type { UserProfileData } from "@/types/user";
import { readProblemDetail } from "@/lib/problemDetails";

/** Every user has this; the backend always keeps it, so it can't be removed here. */
const BASELINE_ROLE = "USER";
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

interface UserRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function sameRoles(a: string[], b: string[]) {
  return a.length === b.length && a.every((role) => b.includes(role));
}

/**
 * Admin-only editor: search a user, load their current roles, add/remove, and
 * save the full list with a PUT. The backend enforces admin-only access; this
 * modal is just only offered to admins.
 */
export function UserRolesModal({ isOpen, onClose }: UserRolesModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlatformUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [available, setAvailable] = useState<string[]>([]);
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [original, setOriginal] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectSeq = useRef(0);

  function reset() {
    setQuery("");
    setPage(0);
    setHasMore(false);
    setResults([]);
    setSelected(null);
    setOriginal([]);
    setRoles([]);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Assignable roles, loaded each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    fetch("/api/users/roles", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<string[]>) : Promise.reject()))
      .then(setAvailable)
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load the role list.");
      });

    return () => controller.abort();
  }, [isOpen]);

  // The user list: everyone when the box is empty, otherwise a debounced
  // username search. Both are paged; `page` > 0 appends ("Load more").
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    const url = trimmed
      ? `/api/users/search?query=${encodeURIComponent(trimmed)}&page=${page}&size=${PAGE_SIZE}`
      : `/api/users/all?page=${page}&size=${PAGE_SIZE}`;

    setSearching(true);

    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        fetch(url, { cache: "no-store", signal: controller.signal })
          .then((res) => (res.ok ? (res.json() as Promise<PlatformUser[]>) : Promise.reject()))
          .then((users) => {
            setResults((prev) => (page === 0 ? users : [...prev, ...users]));
            setHasMore(users.length >= PAGE_SIZE);
          })
          .catch(() => {
            if (controller.signal.aborted) return;
            if (page === 0) setResults([]);
            setHasMore(false);
          })
          .finally(() => {
            if (!controller.signal.aborted) setSearching(false);
          });
      },
      trimmed && page === 0 ? SEARCH_DEBOUNCE_MS : 0,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, page, isOpen]);

  function changeQuery(value: string) {
    setQuery(value);
    setPage(0);
    setHasMore(false);
  }

  async function selectUser(user: PlatformUser) {
    const seq = ++selectSeq.current;

    setSelected(user);
    setError(null);
    setLoadingUser(true);

    try {
      // Load the user's live roles rather than trusting the search row.
      const res = await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(await readProblemDetail(res, "Could not load this user."));
      }

      const profile = (await res.json()) as UserProfileData;

      if (seq !== selectSeq.current) return;
      setOriginal(profile.roles);
      setRoles(profile.roles);
    } catch (e) {
      if (seq !== selectSeq.current) return;
      setSelected(null);
      setError(e instanceof Error ? e.message : "Could not load this user.");
    } finally {
      if (seq === selectSeq.current) setLoadingUser(false);
    }
  }

  async function save() {
    if (!selected) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(selected.id)}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles }),
      });

      if (!res.ok) {
        throw new Error(await readProblemDetail(res, "Could not update roles."));
      }

      const updated = (await res.json()) as UserProfileData;

      setOriginal(updated.roles);
      setRoles(updated.roles);
      addToast({ title: `Roles updated for ${selected.username}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const addable = available.filter((role) => !roles.includes(role));
  const dirty = selected !== null && !sameRoles(roles, original);

  return (
    <Modal
      backdrop="blur"
      isOpen={isOpen}
      scrollBehavior="inside"
      size="lg"
      onClose={handleClose}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Manage user roles
          <span className="text-tiny font-normal text-default-500">
            Pick a user from the list or search by username, then add or remove roles and save.
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          <Input
            autoFocus
            isClearable
            aria-label="Search users"
            endContent={searching ? <Spinner size="sm" /> : null}
            placeholder="Search by username"
            value={query}
            variant="bordered"
            onClear={() => changeQuery("")}
            onValueChange={changeQuery}
          />

          {!searching && results.length === 0 && (
            <p className="text-small text-default-500">No users found.</p>
          )}

          {results.length > 0 && (
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-medium px-2 py-1.5 text-left transition-colors hover:bg-content2 ${
                      selected?.id === user.id ? "bg-content2" : ""
                    }`}
                    type="button"
                    onClick={() => selectUser(user)}
                  >
                    <Avatar
                      name={user.username.charAt(0).toUpperCase()}
                      size="sm"
                      src={user.avatarUrl ?? undefined}
                    />
                    <span className="truncate text-small font-medium text-foreground">
                      {user.username}
                    </span>
                  </button>
                </li>
              ))}
              {hasMore && (
                <li>
                  <Button
                    fullWidth
                    isLoading={searching}
                    size="sm"
                    variant="light"
                    onPress={() => setPage((current) => current + 1)}
                  >
                    Load more
                  </Button>
                </li>
              )}
            </ul>
          )}

          {selected && (
            <div className="flex flex-col gap-3 rounded-medium border border-divider p-3">
              <p className="text-small font-semibold text-foreground">
                {selected.username}
              </p>

              {loadingUser ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-tiny font-bold uppercase tracking-wide text-default-400">
                      Roles
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {roles.map((role) => (
                        <Chip
                          key={role}
                          color={role === "ADMIN" ? "danger" : "primary"}
                          size="sm"
                          variant="flat"
                          onClose={
                            role === BASELINE_ROLE
                              ? undefined
                              : () => setRoles((prev) => prev.filter((r) => r !== role))
                          }
                        >
                          {role}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  {addable.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-tiny font-bold uppercase tracking-wide text-default-400">
                        Add role
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {addable.map((role) => (
                          <Button
                            key={role}
                            className="h-7 min-w-0 px-3 text-tiny"
                            radius="full"
                            size="sm"
                            variant="bordered"
                            onPress={() => setRoles((prev) => [...prev, role])}
                          >
                            + {role}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-medium bg-danger/10 px-3 py-2 text-small text-danger">
              {error}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={handleClose}>
            Close
          </Button>
          <Button
            color="primary"
            isDisabled={!dirty || loadingUser}
            isLoading={saving}
            onPress={save}
          >
            Save roles
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
