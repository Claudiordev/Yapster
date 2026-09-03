"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";

import { MicTest } from "./MicTest";
import { ServerInformationModal } from "./ServerInformationModal";

import { Icon } from "@/components/icon";
import { siteConfig } from "@/config/site";
import { useAccount } from "@/lib/use-account";
import {
  DEFAULT_VIDEO_PREFS,
  DEFAULT_SCREEN_SHARE_AUDIO,
  ECHO_CANCELLATION_KEY,
  NOISE_SUPPRESSION_KEY,
  readAudioProcessingPrefs,
  readVideoPrefs,
  readScreenShareAudioPref,
  VIDEO_FRAME_RATE_KEY,
  VIDEO_RESOLUTION_KEY,
  VIDEO_RESOLUTIONS,
  type VideoFrameRate,
  type VideoResolution,
  writeAudioProcessingPref,
  writeScreenShareAudioPref,
} from "@/lib/media-prefs";

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
        className="volume-bar"
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
  const { roles } = useAccount();
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  const [input, setInput] = useState("default");
  const [output, setOutput] = useState("default");
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);
  const [available, setAvailable] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [videoResolution, setVideoResolution] = useState<VideoResolution>(
    DEFAULT_VIDEO_PREFS.resolution,
  );
  const [videoFrameRate, setVideoFrameRate] = useState<VideoFrameRate>(
    DEFAULT_VIDEO_PREFS.frameRate,
  );
  const [screenShareAudio, setScreenShareAudio] = useState(
    DEFAULT_SCREEN_SHARE_AUDIO,
  );
  const [serverInformationOpen, setServerInformationOpen] = useState(false);
  const isAdmin = roles.includes("ADMIN");

  useEffect(() => {
    setInput(localStorage.getItem(INPUT_KEY) ?? "default");
    setOutput(localStorage.getItem(OUTPUT_KEY) ?? "default");
    setInputVolume(Number(localStorage.getItem(INPUT_VOL_KEY) ?? 100));
    setOutputVolume(Number(localStorage.getItem(OUTPUT_VOL_KEY) ?? 100));

    const audioPrefs = readAudioProcessingPrefs();

    setNoiseSuppression(audioPrefs.noiseSuppression);
    setEchoCancellation(audioPrefs.echoCancellation);

    const videoPrefs = readVideoPrefs();

    setVideoResolution(videoPrefs.resolution);
    setVideoFrameRate(videoPrefs.frameRate);
    setScreenShareAudio(readScreenShareAudioPref());
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
  const outputOptions = [
    { id: "default", label: "System default" },
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

      {/* Mic processing. Applied by the browser on capture, so these take
          effect the next time you join a call, not mid-call. */}
      <div className="flex flex-col gap-3">
        <Switch
          isSelected={noiseSuppression}
          size="sm"
          onValueChange={(enabled) => {
            setNoiseSuppression(enabled);
            writeAudioProcessingPref(NOISE_SUPPRESSION_KEY, enabled);
          }}
        >
          <div className="flex flex-col">
            <span className="text-small">Noise suppression</span>
            <span className="text-tiny text-default-400">
              Filters steady background noise.
            </span>
          </div>
        </Switch>

        <Switch
          isSelected={echoCancellation}
          size="sm"
          onValueChange={(enabled) => {
            setEchoCancellation(enabled);
            writeAudioProcessingPref(ECHO_CANCELLATION_KEY, enabled);
          }}
        >
          <div className="flex flex-col">
            <span className="text-small">Echo cancellation</span>
            <span className="text-tiny text-default-400">
              Stops others hearing themselves back.
            </span>
          </div>
        </Switch>
      </div>

      <div className="h-px bg-divider" />

      <div>
        <h2 className="text-medium font-semibold text-foreground">Video</h2>
        <p className="text-sm text-default-500">
          Quality used when you share your screen.
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full sm:w-1/2">
          <Select
            label="Resolution"
            labelPlacement="outside"
            selectedKeys={[videoResolution]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const value =
                (Array.from(keys)[0] as VideoResolution) ??
                DEFAULT_VIDEO_PREFS.resolution;

              setVideoResolution(value);
              localStorage.setItem(VIDEO_RESOLUTION_KEY, value);
            }}
          >
            {(Object.keys(VIDEO_RESOLUTIONS) as VideoResolution[]).map(
              (key) => (
                <SelectItem key={key}>
                  {`${key} (${VIDEO_RESOLUTIONS[key].width}×${VIDEO_RESOLUTIONS[key].height})`}
                </SelectItem>
              ),
            )}
          </Select>
        </div>

        <div className="w-full sm:w-1/2">
          <Select
            label="Frame rate"
            labelPlacement="outside"
            selectedKeys={[String(videoFrameRate)]}
            variant="bordered"
            onSelectionChange={(keys) => {
              const value = Number(Array.from(keys)[0]) === 60 ? 60 : 30;

              setVideoFrameRate(value);
              localStorage.setItem(VIDEO_FRAME_RATE_KEY, String(value));
            }}
          >
            <SelectItem key="30">30 fps</SelectItem>
            <SelectItem key="60">60 fps</SelectItem>
          </Select>
        </div>
      </div>

      <Switch
        isSelected={screenShareAudio}
        size="sm"
        onValueChange={(enabled) => {
          setScreenShareAudio(enabled);
          writeScreenShareAudioPref(enabled);
        }}
      >
        <div className="flex flex-col">
          <span className="text-small">Share screen audio</span>
          <span className="text-tiny text-default-400">
            Requests audio when you start sharing. Enabled by default.
          </span>
        </div>
      </Switch>

      <p className="text-tiny text-default-400">
        Sends up to{" "}
        {(
          (videoFrameRate === 60
            ? VIDEO_RESOLUTIONS[videoResolution].bitrate60
            : VIDEO_RESOLUTIONS[videoResolution].bitrate30) / 1_000_000
        ).toFixed(1)}{" "}
        Mbps. Higher settings look sharper but need more upload bandwidth.
      </p>

      <div className="h-px bg-divider" />

      <MicTest deviceId={input} />

      {!available && (
        <p className="text-tiny text-default-400">
          Device names require microphone permission and a secure (HTTPS)
          connection. Showing the system default only.
        </p>
      )}

      <div className="h-px bg-divider" />

      {isAdmin && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">
                Server information
              </h2>
              <p className="text-tiny text-default-500">
                View current users and connected devices.
              </p>
            </div>
            <Button
              className="flex-shrink-0"
              size="sm"
              variant="flat"
              onPress={() => setServerInformationOpen(true)}
            >
              View information
            </Button>
          </div>

          <div className="h-px bg-divider" />
        </>
      )}

      <a
        aria-label="GitHub"
        className="flex w-fit items-center gap-2 text-tiny text-default-400 transition-colors hover:text-foreground"
        href={siteConfig.links.github}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Icon name="github" size={16} />
        View on GitHub
      </a>

      <ServerInformationModal
        isOpen={serverInformationOpen}
        onClose={() => setServerInformationOpen(false)}
      />
    </div>
  );
}
