import { Suspense } from "react";

import { LoginForm } from "@/app/(auth)/login/_Components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
