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
import { Select, SelectItem } from "@heroui/select";
import { addToast } from "@heroui/toast";

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GAMES = [
  { key: "minecraft", label: "Minecraft" },
  { key: "cs2", label: "Counter-Strike 2" },
  { key: "valorant", label: "Valorant" },
  { key: "rust", label: "Rust" },
  { key: "ark", label: "ARK: Survival Evolved" },
  { key: "terraria", label: "Terraria" },
  { key: "gmod", label: "Garry's Mod" },
  { key: "palworld", label: "Palworld" },
];

const LOCATIONS = [
  { key: "us-east", label: "US East (N. Virginia)" },
  { key: "us-west", label: "US West (Oregon)" },
  { key: "eu-west", label: "EU West (Ireland)" },
  { key: "eu-central", label: "EU Central (Frankfurt)" },
  { key: "asia", label: "Asia Pacific (Tokyo)" },
  { key: "sa", label: "South America (São Paulo)" },
  { key: "oceania", label: "Oceania (Sydney)" },
];

export function CreateServerModal({ isOpen, onClose }: CreateServerModalProps) {
  const [game, setGame] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  function handleClose() {
    setGame("");
    setName("");
    setLocation("");
    onClose();
  }

  function handleAdd() {
    const gameLabel = GAMES.find((g) => g.key === game)?.label ?? game;
    const where = LOCATIONS.find((l) => l.key === location)?.label ?? location;

    addToast({
      title: "Game server added",
      description: `Created "${name}" — ${gameLabel} in ${where}.`,
    });
    handleClose();
  }

  return (
    <Modal backdrop="blur" isOpen={isOpen} size="xl" onClose={handleClose}>
      <ModalContent>
        <ModalHeader>Add a game server</ModalHeader>
        <ModalBody className="flex flex-col gap-5">
          {/* Form (left) + banner box (right, 50%). */}
          <div className="flex flex-row gap-5">
            <div className="flex w-1/2 flex-col justify-start gap-4">
              <Select
                label="Game"
                labelPlacement="outside"
                placeholder="Choose a game"
                selectedKeys={game ? [game] : []}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setGame((Array.from(keys)[0] as string) ?? "")
                }
              >
                {GAMES.map((g) => (
                  <SelectItem key={g.key}>{g.label}</SelectItem>
                ))}
              </Select>
              <Input
                label="Name"
                labelPlacement="outside"
                placeholder="My server"
                value={name}
                variant="bordered"
                onValueChange={setName}
              />
              <Select
                label="Location"
                labelPlacement="outside"
                placeholder="Choose a location"
                selectedKeys={location ? [location] : []}
                variant="bordered"
                onSelectionChange={(keys) =>
                  setLocation((Array.from(keys)[0] as string) ?? "")
                }
              >
                {LOCATIONS.map((l) => (
                  <SelectItem key={l.key}>{l.label}</SelectItem>
                ))}
              </Select>
            </div>

            <div className="relative w-1/2 overflow-hidden rounded-medium border border-divider shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-deep via-brand-deep to-brand-hover" />
              <div className="absolute -left-6 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/10 blur-xl animate-pulse" />
              <div className="absolute right-6 top-4 h-16 w-16 rounded-full bg-white/10 blur-lg animate-pulse [animation-delay:0.5s]" />
              <div className="absolute bottom-2 right-1/4 h-20 w-20 rounded-full bg-black/10 blur-xl animate-pulse [animation-delay:1s]" />
              <div className="relative z-10 flex h-full flex-col items-start justify-end gap-1 p-6">
                <h2 className="text-2xl font-bold text-white drop-shadow">
                  New game server
                </h2>
                <p className="text-sm text-white/80">
                  Pick a game, name it, choose a region.
                </p>
              </div>
            </div>
          </div>

          {/* Product description — sits below everything. */}
          <p className="text-sm leading-relaxed text-default-500">
            Game servers let you host dedicated multiplayer sessions for your
            community — invite friends, control access, and keep your worlds
            running around the clock.
          </p>
        </ModalBody>
        <ModalFooter className="justify-between">
          <Button variant="flat" onPress={handleClose}>
            Cancel
          </Button>
          <Button
            className="bg-brand text-white hover:bg-brand-hover"
            isDisabled={!game || !name.trim() || !location}
            onPress={handleAdd}
          >
            Add server
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
