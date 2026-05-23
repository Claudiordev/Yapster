"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";

import { ROUTES } from "@/lib/constants";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || ROUTES.HOME;

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
        const body = await res.json();

        setErrors({ form: body.error || "Login failed" });

        return;
      }

      router.push(callbackUrl);
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
        <h1 className="text-2xl font-bold">Sign In</h1>
        <p className="text-small text-default-500">
          Enter your credentials to continue
        </p>
      </div>

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
        placeholder="Enter your username"
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
        placeholder="Enter your password"
        type="password"
      />

      {errors.form && (
        <span className="text-danger text-small">{errors.form}</span>
      )}

      <div className="flex gap-4 w-full">
        <Button
          className="w-full"
          color="primary"
          isLoading={isLoading}
          type="submit"
        >
          Sign In
        </Button>
        <Button type="reset" variant="bordered" onPress={() => setErrors({})}>
          Reset
        </Button>
      </div>

      <p className="text-small text-default-500 text-center w-full">
        Need an account?{" "}
        <Link as={NextLink} href={ROUTES.REGISTER} size="sm">
          Create one
        </Link>
      </p>
    </Form>
  );
}
