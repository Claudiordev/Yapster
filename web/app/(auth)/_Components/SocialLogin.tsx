"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";

import { FEATURE_OAUTH2_LOGIN } from "@/lib/constants";

/**
 * Google sign-in as a logo-only button (the accessible name stays "Continue with Google"). A plain link, not a fetch: the browser is redirected to
 * Google and back (see /api/auth/google/start and /callback).
 */
export function SocialLogin() {
  const callbackUrl = useSearchParams().get("callbackUrl");

  if (!FEATURE_OAUTH2_LOGIN) return null;

  const href = callbackUrl
    ? `/api/auth/google/start?next=${encodeURIComponent(callbackUrl)}`
    : "/api/auth/google/start";

  return (
    <>
      <div className="flex w-full items-center gap-3">
        <div className="h-px flex-grow bg-divider" />
        <span className="text-tiny font-medium text-default-400">OR</span>
        <div className="h-px flex-grow bg-divider" />
      </div>

      <Button
        as="a"
        aria-label="Continue with Google"
        title="Continue with Google"
        className="social-login-button social-login-google w-full"
        href={href}
        variant="bordered"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" height={22} src="/icons/google.svg" width={22} />
      </Button>
    </>
  );
}
