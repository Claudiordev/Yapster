"use client";

import { useEffect, useState } from "react";
import { Select, SelectItem } from "@heroui/select";

import { MicTest } from "./mic-test";

import { DEFAULT_DEVICE, useAudioSettings } from "@/lib/use-audio-settings";

interface AudioDevice {
  id: string;
  label: string;
}

function VolumeBar({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-tiny text-default-500">
        <span>Volume</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <input
        aria-label="Volume"
        className="w-full cursor-pointer accent-brand"
        max={100}
        min={0}
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function SettingsPanel() {
  // Device/volume preferences are global (shared with the call flow); the
  // device *lists* are local UI state since they depend on the browser.
  const {
    inputDeviceId,
    outputDeviceId,
    inputVolume,
    outputVolume,
    setInputDeviceId,
    setOutputDeviceId,
    setInputVolume,
    setOutputVolume,
  } = useAudioSettings();

  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const md =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;

    // mediaDevices is only present in a secure context (HTTPS/localhost).
    if (!md?.enumerateDevices) {
      setAvailable(false);

      return;
    }

    let active = true;

    md.enumerateDevices()
      .then((devices) => {
        if (!active) return;

        const pick = (kind: MediaDeviceKind, prefix: string) =>
          devices
            .filter(
              (d) =>
                d.kind === kind &&
                d.deviceId &&
                d.deviceId !== "default" &&
                d.deviceId !== "communications",
            )
            .map((d, i) => ({
              id: d.deviceId,
              label: d.label || `${prefix} ${i + 1}`,
            }));

        setInputs(pick("audioinput", "Microphone"));
        setOutputs(pick("audiooutput", "Speaker"));
      })
      .catch(() => setAvailable(false));

    return () => {
      active = false;
    };
  }, []);

  const inputOptions = [
    { id: DEFAULT_DEVICE, label: "System default" },
    ...inputs,
  ];
  const outputOptions = [
    { id: DEFAULT_DEVICE, label: "System default" },
    ...outputs,
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-default-500">
          Choose your audio input and output devices.
        </p>
      </div>

      {/* Microphone (input) + Speaker (output) side by side. */}
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="flex w-full flex-col gap-3 sm:w-1/2">
          <Select
            label="Microphone"
            labelPlacement="outside"
            selectedKeys={[inputDeviceId]}
            variant="bordered"
            onSelectionChange={(keys) =>
              setInputDeviceId((Array.from(keys)[0] as string) ?? DEFAULT_DEVICE)
            }
          >
            {inputOptions.map((d) => (
              <SelectItem key={d.id}>{d.label}</SelectItem>
            ))}
          </Select>
          <VolumeBar value={inputVolume} onChange={setInputVolume} />
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-1/2">
          <Select
            label="Speaker"
            labelPlacement="outside"
            selectedKeys={[outputDeviceId]}
            variant="bordered"
            onSelectionChange={(keys) =>
              setOutputDeviceId(
                (Array.from(keys)[0] as string) ?? DEFAULT_DEVICE,
              )
            }
          >
            {outputOptions.map((d) => (
              <SelectItem key={d.id}>{d.label}</SelectItem>
            ))}
          </Select>
          <VolumeBar value={outputVolume} onChange={setOutputVolume} />
        </div>
      </div>

      <div className="h-px bg-divider" />

      <MicTest deviceId={inputDeviceId} />

      {!available && (
        <p className="text-tiny text-default-400">
          Device names require microphone permission and a secure (HTTPS)
          connection. Showing the system default only.
        </p>
      )}
    </div>
  );
}
