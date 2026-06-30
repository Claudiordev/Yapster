"use client";

import { useRef, useState } from "react";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { addToast } from "@heroui/toast";

import { Icon } from "@/components/icon";
import { useAccount } from "@/lib/use-account";

interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AvatarUploadModal({ isOpen, onClose }: AvatarUploadModalProps) {
  const { refresh } = useAccount();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
    setUploading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];

    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const body = new FormData();

      // Backend expects the multipart field named "file" (@RequestParam("file")).
      body.append("file", file);

      const res = await fetch("/api/user/avatar", { method: "POST", body });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        setError(data.error || "Upload failed");

        return;
      }

      await refresh();
      addToast({ title: "Avatar updated" });
      handleClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal backdrop="blur" isOpen={isOpen} size="sm" onClose={handleClose}>
      <ModalContent>
        <ModalHeader>Upload avatar</ModalHeader>
        <ModalBody>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-content2 ring-2 ring-brand/20">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Avatar preview"
                  className="h-full w-full object-cover"
                  src={preview}
                />
              ) : (
                <span className="text-default-400">
                  <Icon name="plus" size={28} />
                </span>
              )}
            </div>

            <Button
              size="sm"
              variant="bordered"
              onPress={() => inputRef.current?.click()}
            >
              {file ? "Choose a different image" : "Choose image"}
            </Button>
            <input
              ref={inputRef}
              accept="image/*"
              className="hidden"
              type="file"
              onChange={handleSelect}
            />

            {error && <p className="text-small text-danger">{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose}>
            Cancel
          </Button>
          <Button
            className="bg-brand text-white hover:bg-brand-hover"
            isDisabled={!file}
            isLoading={uploading}
            onPress={handleUpload}
          >
            Upload
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
