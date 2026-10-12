"use client";

import { useEffect, useRef, useState } from "react";
import { accountRequest } from "@/lib/cloud-repository";
import { notifySessionChange } from "@/lib/session-events";

const errorMessage = (code: string) => {
  if (code === "access_denied")
    return "Google sign-in was cancelled. Your draft is kept in the editor.";
  if (code === "email_does_not_match")
    return "Choose the Google account with the same email as your existing account.";
  if (code.includes("account_not_linked"))
    return "Sign in with your existing email and password, then choose Link Google in Account settings.";
  if (code.includes("already_linked"))
    return "This Google identity is already linked to another account. Your account and drafts were kept.";
  return "Google sign-in could not finish. Return to your editor and try again; your draft is kept.";
};

export default function GoogleComplete() {
  const [status, setStatus] = useState("Checking Google sign-in…");
  const captured = useRef<{ flow: string; error: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (!captured.current) {
      const query = new URLSearchParams(window.location.search);
      captured.current = {
        flow: query.get("flow") || "",
        error: query.get("error") || "",
      };
      window.history.replaceState(null, "", window.location.pathname);
    }
    const { flow, error } = captured.current;
    void (async () => {
      let ok = false;
      let message = "";
      try {
        if (error) throw new Error(errorMessage(error));
        const session = (await accountRequest("/api/account")) as {
          user: unknown;
          googleLinked: boolean;
        };
        if (!session.user || !session.googleLinked)
          throw new Error(
            "No linked Google account session was found. Return to your editor to sign in.",
          );
        ok = true;
        message =
          "Google account confirmed. Return to your existing editor window.";
      } catch (e) {
        message = (e as Error).message;
      }
      if (!active) return;
      setStatus(message);
      notifySessionChange();
      window.opener?.postMessage(
        { type: "cv-google-complete", flow, ok, message },
        window.location.origin,
      );
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="account-panel google-complete">
      <h1>Google sign-in</h1>
      <p role="status">{status}</p>
      <p>
        Your CV stays in its original editor tab. Signing in does not upload
        device drafts.
      </p>
      <button onClick={() => window.close()}>Return to existing editor</button>
      <a href="/builder">Open CV library in this window</a>
    </main>
  );
}
