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
  onClose: () => void;
}

const MENU_WIDTH = 240;
const MENU_HEIGHT = 156;

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
  onClose,
}: ParticipantVolumeMenuProps) {
  return (
    <FloatingMenu
      className="w-60 p-3"
      height={MENU_HEIGHT}
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
      ) : (
        <p className="mb-2 truncate text-sm font-medium text-foreground">{name}</p>
      )}
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
    </FloatingMenu>
  );
}
