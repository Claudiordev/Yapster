"use client";

import { useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { useSound } from "react-sounds";

import { AuthLoading } from "../../_Components/auth-loading";
import { RotatingTagline } from "../../_Components/rotating-tagline";
import { SocialLogin } from "../../_Components/social-login";

import { ROUTES } from "@/lib/constants";
import { readProblemDetail } from "@/lib/problem-details";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || ROUTES.HOME;

  const [isLoading, setIsLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { play: playSubmit } = useSound("ui/submit");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    playSubmit();
    setErrors({});
    setIsLoading(true);

    const data = Object.fromEntries(new FormData(e.currentTarget));

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        setErrors({ form: await readProblemDetail(res, "Login failed") });

        return;
      }

      // Show the branded loader, then hard-navigate so the browser sends the
      // freshly-set auth cookie and the middleware sees us authenticated (a
      // client-side push can use a stale, logged-out cache and bounce back).
      setNavigating(true);
      window.location.assign(callbackUrl);
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {navigating && <AuthLoading />}
      <div className="flex w-full max-w-3xl flex-col items-center">
        <div className="mb-10 w-full">
          <RotatingTagline />
        </div>

        <div className="login-form-frame grid w-full overflow-hidden md:grid-cols-[minmax(0,7fr)_minmax(9rem,3fr)]">
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

          <div className="flex flex-col items-center justify-center gap-3 border-t border-divider bg-content1/30 p-6 md:border-t-0 md:border-l">
            <Image
              priority
              alt="Yaappr"
              className="h-auto w-36 sm:w-40 md:w-full md:max-w-44"
              height={1254}
              src="/images/logo.png"
              width={1254}
            />
          </div>
        </div>
      </div>
    </>
  );
}
