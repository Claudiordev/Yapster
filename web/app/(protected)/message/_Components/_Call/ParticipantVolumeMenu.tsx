"use client";

import { Button } from "@heroui/button";

import { FloatingMenu } from "@/components/FloatingMenu/FloatingMenu";
import { Icon } from "@/components/Icon/Icon";
import { VolumeControl } from "@/components/VolumeControl/VolumeControl";

interface ParticipantVolumeMenuProps {
  name: string;
  volume: number;
  showLocalControls: boolean;
  canMuteForEveryone: boolean;
  isMutedForEveryone: boolean;
  x: number;
  y: number;
  onChange: (volume: number) => void;
  onToggleMute: () => void;
  onMuteForEveryone: () => void;
  onOpenProfile: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 240;

export function ParticipantVolumeMenu({
  name,
  volume,
  showLocalControls,
  canMuteForEveryone,
  isMutedForEveryone,
  x,
  y,
  onChange,
  onToggleMute,
  onMuteForEveryone,
  onOpenProfile,
  onClose,
}: ParticipantVolumeMenuProps) {
  // Profile row always; volume and mute-for-everyone only where the caller allows them.
  const height =
    52 + (showLocalControls ? 112 : 0) + (canMuteForEveryone ? 44 : 0);

  return (
    <FloatingMenu
      className="w-60 p-3"
      height={height}
      label={`Call controls for ${name}`}
      width={MENU_WIDTH}
      x={x}
      y={y}
      onClose={onClose}
    >
      {showLocalControls ? (
        <>
          <VolumeControl
            ariaLabel={`${name} volume`}
            caption="Voice volume"
            name={name}
            volume={volume}
            onChange={onChange}
          />
          <Button
            aria-label={volume === 0 ? `Unmute ${name}` : `Mute ${name}`}
            className="mt-3 w-full"
            color={volume === 0 ? "danger" : "default"}
            size="sm"
            startContent={
              <Icon name={volume === 0 ? "mic-off" : "mic"} size={14} />
            }
            variant="flat"
            onPress={onToggleMute}
          >
            {volume === 0 ? "Muted" : "Unmuted"}
          </Button>
        </>
      ) : null}
      {canMuteForEveryone && (
        <Button
          aria-label={`Mute ${name} for everyone`}
          className={`${showLocalControls ? "mt-2" : "mt-1"} w-full`}
          color="danger"
          isDisabled={isMutedForEveryone}
          size="sm"
          startContent={<Icon name="mic-off" size={14} />}
          variant="flat"
          onPress={onMuteForEveryone}
        >
          {isMutedForEveryone ? "Muted for everyone" : "Mute for everyone"}
        </Button>
      )}
      <button
        className={`${showLocalControls || canMuteForEveryone ? "mt-2" : ""} flex w-full items-center gap-2 rounded-small px-2 py-1.5 text-left text-sm text-foreground hover:bg-content2`}
        type="button"
        onClick={onOpenProfile}
      >
        <Icon className="text-default-400" name="user" size={14} />
        Profile
      </button>
    </FloatingMenu>
  );
}
