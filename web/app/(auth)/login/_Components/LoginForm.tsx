"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";

import { RotatingTagline } from "../../_Components/RotatingTagline";
import { SocialLogin } from "../../_Components/SocialLogin";

/** Messages for the ?error= keys the Keycloak callback redirects back with. */
const LOGIN_ERRORS: Record<string, string> = {
  login_cancelled: "Sign-in was cancelled.",
  login_state: "Sign-in expired or was interrupted. Please try again.",
  login_failed: "Sign-in failed. Please try again.",
  login_unavailable: "Sign-in isn't available right now.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const error = LOGIN_ERRORS[searchParams.get("error") ?? ""];
  const signInHref = callbackUrl
    ? `/api/auth/login?next=${encodeURIComponent(callbackUrl)}`
    : "/api/auth/login";

  return (
    <>
      <div className="flex w-full max-w-3xl flex-col items-center">
        <div className="mb-10 w-full">
          <RotatingTagline />
        </div>

        <div className="login-form-frame w-full max-w-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Welcome back
              </h1>
              <p className="mt-1 text-small text-default-500">
                We are happy to see you again
              </p>
            </div>

            <div className="flex w-full flex-col gap-4">
              {error && (
                <div className="rounded-medium bg-danger/10 px-3 py-2 text-small text-danger">
                  {error}
                </div>
              )}

              <Button as="a" className="login-sign-in w-full" href={signInHref}>
                Sign In
              </Button>

              <SocialLogin />

              <p className="w-full text-center text-small text-default-500">
                Need an account?{" "}
                <Link
                  className="text-brand"
                  href="/api/auth/login?mode=register"
                  size="sm"
                >
                  Create one
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
