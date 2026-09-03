"use client";

import { Button } from "@heroui/button";

import { Icon } from "@/components/icon";
import { FEATURE_OAUTH2_LOGIN } from "@/lib/constants";

const PROVIDERS = [
  {
    label: "Google",
    icon: <img alt="" height={20} src="/icons/google.svg" width={20} />,
    className: "social-login-button social-login-google flex-1",
  },
  {
    label: "Discord",
    icon: <Icon name="discord" size={20} />,
    className: "social-login-button social-login-discord flex-1",
  },
];

export function SocialLogin() {
  if (!FEATURE_OAUTH2_LOGIN) return null;

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
            className={p.className}
            type="button"
            variant="bordered"
          >
            {p.icon}
            <span>{p.label}</span>
          </Button>
        ))}
      </div>
    </>
  );
}
