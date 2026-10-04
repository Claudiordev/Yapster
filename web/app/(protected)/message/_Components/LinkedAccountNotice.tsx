"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addToast } from "@heroui/toast";

/** Messages for the ?linkError= keys the Google callback sends back after "Link Google". */
const LINK_ERRORS: Record<string, string> = {
  google_cancelled: "Linking Google was cancelled.",
  google_state: "Linking Google expired or was interrupted. Please try again.",
  google_account_taken: "That Google account is already linked to another user.",
  google_already_linked: "A Google account is already linked. Unlink it first.",
  google_unavailable: "Linking Google isn't available right now.",
  google_failed: "Couldn't link Google. Please try again.",
};

/** Shows the result of linking a Google account (it comes back as a query param), then clears it from the URL. */
export function LinkedAccountNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const linked = params.get("linked");
  const linkError = params.get("linkError");

  useEffect(() => {
    if (linked !== "google" && !linkError) return;

    if (linked === "google") {
      addToast({ title: "Google account linked", color: "success" });
    } else if (linkError) {
      addToast({
        title: LINK_ERRORS[linkError] ?? LINK_ERRORS.google_failed,
        color: "danger",
      });
    }

    const rest = new URLSearchParams(params.toString());

    rest.delete("linked");
    rest.delete("linkError");
    router.replace(rest.size > 0 ? `${pathname}?${rest}` : pathname);
  }, [linked, linkError, params, pathname, router]);

  return null;
}
