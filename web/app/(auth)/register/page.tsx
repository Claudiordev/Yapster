import { redirect } from "next/navigation";

/** Registration lives on Keycloak now; this just sends the browser to its registration form. */
export default function RegisterPage() {
  redirect("/api/auth/login?mode=register");
}
