"use client";
import { useEffect, useRef, useState } from "react";
import { notifySessionChange } from "@/lib/session-events";
import { accountRequest } from "@/lib/cloud-repository";

export default function VerificationComplete() {
  const [status, setStatus] = useState<
    "checking" | "verified" | "unknown" | "failed"
  >("checking");
  const link = useRef<{ captured: boolean; failed: boolean }>({
    captured: false,
    failed: false,
  });
  useEffect(() => {
    let active = true;
    if (!link.current.captured) {
      link.current = {
        captured: true,
        failed: new URLSearchParams(window.location.search).has("error"),
      };
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (link.current.failed) setStatus("failed");
    else
      void accountRequest("/api/account")
        .then((result) => {
          if (!active) return;
          const account = result as {
            user?: { emailVerified?: boolean } | null;
          };
          setStatus(
            account.user?.emailVerified === true ? "verified" : "unknown",
          );
          notifySessionChange();
        })
        .catch(() => {
          if (active) setStatus("unknown");
        });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="account-panel">
      <h1>
        {status === "failed"
          ? "This verification link is invalid or expired"
          : status === "verified"
            ? "Email verified"
            : status === "checking"
              ? "Checking email verification"
              : "Check your email verification status"}
      </h1>
      <p>
        {status === "failed"
          ? "Return to Account settings and request a new verification email."
          : status === "verified"
            ? "Return to your existing editor tab. Refresh verification status in Account settings to continue your chosen export."
            : "Open Account settings and sign in to check whether your email is verified. Your existing editor draft stays in its tab."}
      </p>
      <a href="/builder">Open CV library</a>
    </main>
  );
}
