"use client";

import { useEffect, useState } from "react";
import { Select, SelectItem } from "@heroui/select";

import { MicTest } from "./mic-test";

interface AudioDevice {
  id: string;
  label: string;
}

const INPUT_KEY = "audio-input-device";
const OUTPUT_KEY = "audio-output-device";
const INPUT_VOL_KEY = "audio-input-volume";
const OUTPUT_VOL_KEY = "audio-output-volume";

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
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  const [input, setInput] = useState("default");
  const [output, setOutput] = useState("default");
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    setInput(localStorage.getItem(INPUT_KEY) ?? "default");
    setOutput(localStorage.getItem(OUTPUT_KEY) ?? "default");
    setInputVolume(Number(localStorage.getItem(INPUT_VOL_KEY) ?? 100));
    setOutputVolume(Number(localStorage.getItem(OUTPUT_VOL_KEY) ?? 100));

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

  function changeInputVolume(v: number) {
    setInputVolume(v);
    localStorage.setItem(INPUT_VOL_KEY, String(v));
  }

  function changeOutputVolume(v: number) {
    setOutputVolume(v);
    localStorage.setItem(OUTPUT_VOL_KEY, String(v));
  }

  const inputOptions = [{ id: "default", label: "System default" }, ...inputs];
  const outputOptions = [{ id: "default", label: "System default" }, ...outputs];

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
            selectedKeys={[input]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const id = (Array.from(keys)[0] as string) ?? "default";

              setInput(id);
              localStorage.setItem(INPUT_KEY, id);
            }}
          >
            {inputOptions.map((d) => (
              <SelectItem key={d.id}>{d.label}</SelectItem>
            ))}
          </Select>
          <VolumeBar value={inputVolume} onChange={changeInputVolume} />
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-1/2">
          <Select
            label="Speaker"
            labelPlacement="outside"
            selectedKeys={[output]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const id = (Array.from(keys)[0] as string) ?? "default";

              setOutput(id);
              localStorage.setItem(OUTPUT_KEY, id);
            }}
          >
            {outputOptions.map((d) => (
              <SelectItem key={d.id}>{d.label}</SelectItem>
            ))}
          </Select>
          <VolumeBar value={outputVolume} onChange={changeOutputVolume} />
        </div>
      </div>

      <div className="h-px bg-divider" />

      <MicTest deviceId={input} />

      {!available && (
        <p className="text-tiny text-default-400">
          Device names require microphone permission and a secure (HTTPS)
          connection. Showing the system default only.
        </p>
      )}
    </div>
  );
}
