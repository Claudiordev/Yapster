"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { Switch } from "@heroui/switch";
import { Tab, Tabs } from "@heroui/tabs";

import type { CommunityServer, ServerPermission } from "@/types/server";

import { ServerIconPicker } from "./ServerIconPicker";
import { PERMISSION_GROUPS } from "./utils/permissions";

interface ServerSettingsModalProps {
  isOpen: boolean;
  server: CommunityServer;
  memberCount: number;
  canManageRoles: boolean;
  canManageServer: boolean;
  isOwner: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onChangeIcon: (iconUrl: string | undefined) => void;
  onTogglePermission: (roleId: string, permission: ServerPermission) => void;
  onDelete: () => void;
}

export function ServerSettingsModal({
  isOpen,
  server,
  memberCount,
  canManageRoles,
  canManageServer,
  isOwner,
  onClose,
  onRename,
  onChangeIcon,
  onTogglePermission,
  onDelete,
}: ServerSettingsModalProps) {
  const [name, setName] = useState(server.name);
  const [roleId, setRoleId] = useState(server.roles.find((r) => r.tier === "mod")?.id ?? server.roles[0].id);

  const role = server.roles.find((r) => r.id === roleId) ?? server.roles[0];
  const locked = role.tier === "owner";

  return (
    <Modal
      backdrop="blur"
      classNames={{
        backdrop: "bg-black/70 backdrop-blur-2xl backdrop-saturate-50",
        base: "start-card",
        closeButton: "right-4 top-4 rounded-full border border-white/15",
      }}
      isOpen={isOpen}
      scrollBehavior="inside"
      size="3xl"
      onClose={onClose}
    >
      <ModalContent>
        <ModalHeader className="px-7 pt-7 pb-0 text-[22px] font-bold tracking-tight">
          {server.name} settings
        </ModalHeader>
        <ModalBody className="px-7 pt-3 pb-7">
          <Tabs aria-label="Server settings" color="danger" variant="underlined">
            <Tab key="overview" title="Overview">
              <div className="flex flex-col gap-5 pt-2">
                <div className="flex items-center gap-5">
                  <ServerIconPicker
                    disabled={!canManageServer}
                    name={server.name}
                    size={96}
                    value={server.iconUrl}
                    onChange={onChangeIcon}
                  />
                  <p className="text-sm text-default-500">
                    The icon shows on the server list on the left. Square images work best.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Input
                    aria-label="Server name"
                    classNames={{ inputWrapper: "h-11 border-[#46424d] bg-[#18191d]" }}
                    isDisabled={!canManageServer}
                    maxLength={40}
                    value={name}
                    variant="bordered"
                    onValueChange={setName}
                  />
                  <Button
                    className="btn-coral h-11 font-bold"
                    isDisabled={!canManageServer || !name.trim() || name === server.name}
                    onPress={() => onRename(name.trim())}
                  >
                    Save
                  </Button>
                </div>

                <dl className="grid grid-cols-3 gap-3">
                  {[
                    ["Members", memberCount],
                    ["Channels", server.channels.length],
                    ["Roles", server.roles.length],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[10px] border border-[#2f3036] bg-[#18191d] p-3">
                      <dt className="text-xs text-default-500">{label}</dt>
                      <dd className="text-2xl font-bold text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex items-center justify-between gap-3 rounded-[10px] border border-danger/40 p-4">
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">Delete server</span>
                    <span className="text-xs text-default-500">
                      Removes every channel and message. This cannot be undone.
                    </span>
                  </span>
                  <Button color="danger" isDisabled={!isOwner} onPress={onDelete}>
                    Delete
                  </Button>
                </div>
              </div>
            </Tab>

            <Tab key="roles" title="Roles">
              <div className="flex gap-5 pt-2">
                <ul className="flex w-44 flex-shrink-0 flex-col gap-1.5">
                  {server.roles.map((r) => (
                    <li key={r.id}>
                      <button
                        aria-pressed={r.id === roleId}
                        className={`flex w-full items-center gap-3 rounded-medium border-2 border-transparent px-3 py-2 text-left transition-[background-color,border-color,box-shadow] ${
                          r.id === roleId ? "chat-conversation-active text-white" : "text-foreground hover:bg-default-100"
                        }`}
                        type="button"
                        onClick={() => setRoleId(r.id)}
                      >
                        <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: r.color }} />
                        <span className="truncate font-medium">{r.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="min-w-0 flex-grow">
                  {!canManageRoles && (
                    <p className="mb-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                      You need MANAGE_ROLES to edit permissions.
                    </p>
                  )}
                  {locked && (
                    <p className="mb-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                      The owner role always has every permission.
                    </p>
                  )}
                  {PERMISSION_GROUPS.map((g) => (
                    <section key={g.group} className="mb-4">
                      <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-default-500">{g.group}</h4>
                      {g.items.map((p) => (
                        <div
                          key={p.key}
                          className="flex items-center justify-between gap-4 border-b border-white/5 py-2.5"
                        >
                          <span className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">{p.label}</span>
                            <span className="text-xs text-default-500">{p.hint}</span>
                          </span>
                          <Switch
                            aria-label={p.label}
                            color="success"
                            isDisabled={!canManageRoles || locked}
                            isSelected={locked || role.permissions.includes(p.key)}
                            size="sm"
                            onValueChange={() => onTogglePermission(role.id, p.key)}
                          />
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </div>
            </Tab>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
