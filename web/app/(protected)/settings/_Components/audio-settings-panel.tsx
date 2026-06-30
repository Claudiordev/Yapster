"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Form } from "@heroui/form";
import { Select, SelectItem } from "@heroui/select";

import { useAudioSettings } from "@/components/audio-settings-provider";

interface OutputDevice {
  deviceId: string;
  label: string;
}

/** Sentinel key used by the Select to represent the system default speaker. */
const DEFAULT_SPEAKER_KEY = "__default__";

export function AudioSettingsPanel() {
  const { settings, updateSettings } = useAudioSettings();

  const [devices, setDevices] = useState<OutputDevice[]>([]);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Draft state — committed to the global settings only on save.
  const [microphoneVolume, setMicrophoneVolume] = useState(
    settings.microphoneVolume,
  );
  const [speakerDeviceId, setSpeakerDeviceId] = useState(
    settings.speakerDeviceId,
  );

  // Re-sync the draft when the global settings hydrate from storage or change.
  useEffect(() => {
    setMicrophoneVolume(settings.microphoneVolume);
    setSpeakerDeviceId(settings.speakerDeviceId);
  }, [settings.microphoneVolume, settings.speakerDeviceId]);

  const loadDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDeviceNotice("This browser does not expose audio devices.");

      return;
    }

    // Device labels are only populated once the user has granted microphone
    // permission. Request it (and immediately release the stream) so the
    // speaker list shows real names rather than blank entries.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      stream.getTracks().forEach((track) => track.stop());
      setDeviceNotice(null);
    } catch {
      setDeviceNotice(
        "Allow microphone access to see your speaker names.",
      );
    }

    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const outputs = all
        .filter((device) => device.kind === "audiooutput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${index + 1}`,
        }));

      setDevices(outputs);
    } catch {
      setDeviceNotice("Unable to list audio output devices.");
    }
  }, []);

  useEffect(() => {
    loadDevices();

    if (!navigator.mediaDevices) return;

    navigator.mediaDevices.addEventListener("devicechange", loadDevices);

    return () =>
      navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
  }, [loadDevices]);

  const speakerOptions = useMemo(
    () => [
      { key: DEFAULT_SPEAKER_KEY, label: "System default" },
      ...devices.map((device) => ({
        key: device.deviceId,
        label: device.label,
      })),
    ],
    [devices],
  );

  const hasChanges =
    microphoneVolume !== settings.microphoneVolume ||
    speakerDeviceId !== settings.speakerDeviceId;

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateSettings({ microphoneVolume, speakerDeviceId });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset() {
    setMicrophoneVolume(settings.microphoneVolume);
    setSpeakerDeviceId(settings.speakerDeviceId);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audio Settings</h1>
        {saved && (
          <Chip color="success" variant="flat">
            Settings saved
          </Chip>
        )}
      </div>

      <Divider />

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <h2 className="text-lg font-semibold">Microphone &amp; Speaker</h2>
          <p className="text-sm text-default-500">
            Set your microphone volume and preferred speaker. These apply across
            the whole app.
          </p>
        </CardHeader>
        <Divider />
        <CardBody>
          <Form className="flex flex-col gap-6" onSubmit={handleSave}>
            <div className="flex w-full flex-col gap-2">
              <label
                className="text-sm font-medium"
                htmlFor="microphone-volume"
              >
                Microphone Volume
              </label>
              <div className="flex items-center gap-4">
                <input
                  aria-label="Microphone volume"
                  className="h-2 w-full cursor-pointer accent-primary"
                  id="microphone-volume"
                  max={100}
                  min={0}
                  step={1}
                  type="range"
                  value={microphoneVolume}
                  onChange={(e) => setMicrophoneVolume(Number(e.target.value))}
                />
                <span className="w-12 text-right text-sm tabular-nums text-default-500">
                  {microphoneVolume}%
                </span>
              </div>
              <p className="text-xs text-default-400">
                Adjust how loud your microphone is captured during calls.
              </p>
            </div>

            <Select
              description="Choose the device used to play call audio."
              items={speakerOptions}
              label="Speaker"
              labelPlacement="outside"
              placeholder="System default"
              selectedKeys={[speakerDeviceId || DEFAULT_SPEAKER_KEY]}
              variant="bordered"
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0] as string | undefined;

                setSpeakerDeviceId(
                  !key || key === DEFAULT_SPEAKER_KEY ? "" : key,
                );
              }}
            >
              {(option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              )}
            </Select>

            {deviceNotice && (
              <p className="text-xs text-warning">{deviceNotice}</p>
            )}

            <div className="flex w-full justify-end gap-2">
              <Button
                isDisabled={!hasChanges}
                variant="flat"
                onPress={handleReset}
              >
                Reset
              </Button>
              <Button color="primary" isDisabled={!hasChanges} type="submit">
                Save Changes
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
}
