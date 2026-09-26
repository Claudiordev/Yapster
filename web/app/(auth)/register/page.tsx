import { Suspense } from "react";

import { RegisterForm } from "@/app/(auth)/register/_Components/RegisterForm";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
