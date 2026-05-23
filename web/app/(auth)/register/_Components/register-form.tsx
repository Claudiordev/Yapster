"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";

import { ROUTES } from "@/lib/constants";

export function RegisterForm() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const data = Object.fromEntries(
      new FormData(e.currentTarget),
    ) as Record<string, string>;

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
        const body = await res.json().catch(() => ({}));

        setErrors({ form: body.error || "Registration failed" });

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
        router.push(ROUTES.LOGIN);

        return;
      }

      router.push(ROUTES.HOME);
      router.refresh();
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      className="w-full max-w-xs flex flex-col gap-4"
      validationErrors={errors}
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="text-small text-default-500">
          Sign up to start using WebPhone
        </p>
      </div>

      <Input
        isRequired
        autoComplete="username"
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
      />

      <Input
        isRequired
        autoComplete="email"
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
      />

      <Input
        isRequired
        autoComplete="email"
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
      />

      <Input
        isRequired
        autoComplete="new-password"
        errorMessage={({ validationDetails }) => {
          if (validationDetails.valueMissing) {
            return "Please choose a password";
          }

          return errors.password;
        }}
        label="Password"
        labelPlacement="outside"
        minLength={8}
        name="password"
        placeholder="At least 8 characters"
        type="password"
      />

      {errors.form && (
        <span className="text-danger text-small">{errors.form}</span>
      )}

      <Button
        className="w-full"
        color="primary"
        isLoading={isLoading}
        type="submit"
      >
        Create account
      </Button>

      <p className="text-small text-default-500 text-center w-full">
        Already have an account?{" "}
        <Link as={NextLink} href={ROUTES.LOGIN} size="sm">
          Sign in
        </Link>
      </p>
    </Form>
  );
}
