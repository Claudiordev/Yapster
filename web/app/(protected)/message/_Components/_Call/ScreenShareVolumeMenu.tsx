"use client";

import { FloatingMenu } from "@/components/FloatingMenu/FloatingMenu";
import { VolumeControl } from "@/components/VolumeControl/VolumeControl";

interface ScreenShareVolumeMenuProps {
  name: string;
  volume: number;
  x: number;
  y: number;
  onChange: (volume: number) => void;
  onClose: () => void;
}

const MENU_WIDTH = 240;
const MENU_HEIGHT = 100;

export function ScreenShareVolumeMenu({
  name,
  volume,
  x,
  y,
  onChange,
  onClose,
}: ScreenShareVolumeMenuProps) {
  return (
    <FloatingMenu
      className="w-60 p-3"
      height={MENU_HEIGHT}
      label={`Screen share volume for ${name}`}
      width={MENU_WIDTH}
      x={x}
      y={y}
      onClose={onClose}
    >
      <VolumeControl
        ariaLabel={`${name} screen share volume`}
        caption="Screen share volume"
        name={name}
        volume={volume}
        onChange={onChange}
      />
    </FloatingMenu>
  );
}
