"use client";

import { useState } from "react";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { useSound } from "react-sounds";

import { RotatingTagline } from "../../_Components/rotating-tagline";

import { Icon } from "@/components/icon";
import { ROUTES } from "@/lib/constants";
import { readProblemDetail } from "@/lib/problem-details";

const INPUT_CLASSNAMES = { inputWrapper: "border-small bg-content1" };

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { play: playSubmit } = useSound("ui/submit");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    playSubmit();
    setErrors({});

    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;

    if (data.email !== data.confirmEmail) {
      setErrors({ confirmEmail: "Emails do not match" });

      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          email: data.email,
          confirmEmail: data.confirmEmail,
          password: data.password,
        }),
      });

      if (!res.ok) {
        setErrors({
          form: await readProblemDetail(res, "Registration failed"),
        });

        return;
      }

      // After successful registration, sign the user in automatically.
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
        }),
      });

      if (!loginRes.ok) {
        setErrors({
          form: await readProblemDetail(loginRes, "Automatic login failed"),
        });

        return;
      }

      // Hard navigation so the middleware sees the freshly-set auth cookie
      // (a client-side push can bounce back to /login on the first try).
      window.location.assign(ROUTES.HOME);
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-center">
      <div className="mb-10 w-full">
        <RotatingTagline />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <span className="text-brand">
            <Icon name="logo" size={44} />
          </span>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Create account
            </h1>
          </div>
        </div>

        <div className="login-form-frame p-6">
          <Form
            className="flex w-full flex-col gap-4"
            validationErrors={errors}
            onSubmit={onSubmit}
          >
            <Input
              isRequired
              autoComplete="username"
              classNames={INPUT_CLASSNAMES}
              errorMessage={({ validationDetails }) => {
                if (validationDetails.valueMissing) {
                  return "Please enter a username";
                }

                return errors.username;
              }}
              label="Username"
              labelPlacement="outside"
              name="username"
              placeholder="Choose a username"
              variant="bordered"
            />

            <Input
              isRequired
              autoComplete="email"
              classNames={INPUT_CLASSNAMES}
              errorMessage={({ validationDetails }) => {
                if (validationDetails.valueMissing) {
                  return "Please enter your email";
                }
                if (validationDetails.typeMismatch) {
                  return "Please enter a valid email";
                }

                return errors.email;
              }}
              label="Email"
              labelPlacement="outside"
              name="email"
              placeholder="you@example.com"
              type="email"
              variant="bordered"
            />

            <Input
              isRequired
              autoComplete="email"
              classNames={INPUT_CLASSNAMES}
              errorMessage={({ validationDetails }) => {
                if (validationDetails.valueMissing) {
                  return "Please confirm your email";
                }

                return errors.confirmEmail;
              }}
              label="Confirm email"
              labelPlacement="outside"
              name="confirmEmail"
              placeholder="Re-enter your email"
              type="email"
              variant="bordered"
            />

            <Input
              isRequired
              autoComplete="new-password"
              classNames={INPUT_CLASSNAMES}
              errorMessage={({ validationDetails }) => {
                if (validationDetails.valueMissing) {
                  return "Please choose a password";
                }
                if (validationDetails.tooShort) {
                  return "Password must be at least 8 characters";
                }

                return errors.password;
              }}
              label="Password"
              labelPlacement="outside"
              minLength={8}
              name="password"
              placeholder="At least 8 characters"
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
              Create account
            </Button>

            <p className="w-full text-center text-small text-default-500">
              Already have an account?{" "}
              <Link
                as={NextLink}
                className="text-brand"
                href={ROUTES.LOGIN}
                size="sm"
              >
                Sign in
              </Link>
            </p>
          </Form>
        </div>
      </div>
    </div>
  );
}
