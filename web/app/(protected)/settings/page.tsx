import { AudioSettingsPanel } from "./_Components/audio-settings-panel";
import { SettingsPanel } from "./_Components/settings-panel";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-10">
      <AudioSettingsPanel />
      <SettingsPanel />
    </div>
  );
}
