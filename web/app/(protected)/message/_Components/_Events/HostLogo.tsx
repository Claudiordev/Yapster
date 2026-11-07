import Image from "next/image";

/** The app's logo, shown wherever an event says "Hosted by" (all events are hosted by us for now). */
export function HostLogo({ size = 24 }: { size?: number }) {
  return (
    <Image
      alt=""
      className="flex-shrink-0 rounded-small"
      height={size}
      src="/images/voxsi-logo.png"
      width={size}
    />
  );
}
