"use client";

import { Button } from "@heroui/button";

import { Icon } from "@/components/icon";

const PROVIDERS = [
  {
    label: "Google",
    icon: <img alt="" height={20} src="/icons/google.svg" width={20} />,
    className:
      "flex-1 data-[hover=true]:bg-[#4285f4]/15 data-[hover=true]:border-[#4285f4]/40",
  },
  {
    label: "GitHub",
    icon: <Icon name="github" size={20} />,
    className:
      "flex-1 text-foreground data-[hover=true]:bg-foreground/10 data-[hover=true]:border-foreground/30",
  },
  {
    label: "Facebook",
    icon: <Icon name="facebook" size={20} />,
    className:
      "flex-1 text-facebook data-[hover=true]:bg-facebook/15 data-[hover=true]:border-facebook/40",
  },
  {
    label: "Discord",
    icon: <Icon name="discord" size={20} />,
    className:
      "flex-1 text-discord data-[hover=true]:bg-discord/15 data-[hover=true]:border-discord/40",
  },
];

export function SocialLogin() {
  return (
    <>
      <div className="flex w-full items-center gap-3">
        <div className="h-px flex-grow bg-divider" />
        <span className="text-tiny font-medium text-default-400">OR</span>
        <div className="h-px flex-grow bg-divider" />
      </div>

      <div className="flex w-full gap-2">
        {PROVIDERS.map((p) => (
          <Button
            key={p.label}
            aria-label={`Continue with ${p.label}`}
            className={`border-small ${p.className}`}
            type="button"
            variant="bordered"
          >
            {p.icon}
          </Button>
        ))}
      </div>
    </>
  );
}
