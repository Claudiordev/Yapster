"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { useSound } from "react-sounds";

import { AuthLoading } from "../../_Components/AuthLoading";
import { RotatingTagline } from "../../_Components/RotatingTagline";
import { SocialLogin } from "../../_Components/SocialLogin";

import { ROUTES } from "@/lib/constants";
import { readProblemDetail } from "@/lib/problemDetails";

/** Messages for the ?error= keys the Google callback redirects back with. */
const OAUTH_ERRORS: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "Google sign-in expired or was interrupted. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_email_taken:
    "An account with this email already exists. Log in with your password.",
  google_unavailable: "Google sign-in isn't available right now.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || ROUTES.HOME;

  const [isLoading, setIsLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const oauthError = OAUTH_ERRORS[searchParams.get("error") ?? ""];
  const [errors, setErrors] = useState<Record<string, string>>(
    oauthError ? { form: oauthError } : {},
  );
  const { play: playSubmit } = useSound("ui/submit");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    playSubmit();
    setErrors({});
    setIsLoading(true);
    // The loader shows from the moment we send the request; its bar follows the request's phases.
    setNavigating(true);
    setProgress(10);

    const data = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        setNavigating(false);
        setErrors({ form: await readProblemDetail(res, "Login failed") });

        return;
      }

      // Response headers are in; now the body (the session pair) is read.
      setProgress(60);
      await res.arrayBuffer();
      setProgress(100);
      // Hard-navigate so the browser sends the freshly-set auth cookie and the
      // middleware sees us authenticated (a client-side push can use a stale,
      // logged-out cache and bounce back).
      window.location.assign(callbackUrl);
    } catch {
      setNavigating(false);
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {navigating && <AuthLoading progress={progress} />}
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

            <Form
              className="flex w-full flex-col gap-4"
              validationErrors={errors}
              onSubmit={onSubmit}
            >
              <Input
                isRequired
                errorMessage={({ validationDetails }) => {
                  if (validationDetails.valueMissing) {
                    return "Please enter your username";
                  }

                  return errors.username;
                }}
                label="Username"
                labelPlacement="outside"
                name="username"
                classNames={{ inputWrapper: "border-small bg-content1" }}
                placeholder="Enter your username"
                variant="bordered"
              />

              <Input
                isRequired
                errorMessage={({ validationDetails }) => {
                  if (validationDetails.valueMissing) {
                    return "Please enter your password";
                  }

                  return errors.password;
                }}
                label="Password"
                labelPlacement="outside"
                name="password"
                classNames={{ inputWrapper: "border-small bg-content1" }}
                placeholder="Enter your password"
                type="password"
                variant="bordered"
              />

              {errors.form && (
                <div className="rounded-medium bg-danger/10 px-3 py-2 text-small text-danger">
                  {errors.form}
                </div>
              )}

              <Button
                className="login-sign-in w-full"
                isLoading={isLoading}
                type="submit"
              >
                Sign In
              </Button>

              <SocialLogin />

              <p className="w-full text-center text-small text-default-500">
                Need an account?{" "}
                <Link
                  as={NextLink}
                  className="text-brand"
                  href={ROUTES.REGISTER}
                  size="sm"
                >
                  Create one
                </Link>
              </p>
            </Form>
          </div>
        </div>
      </div>
    </>
  );
}
