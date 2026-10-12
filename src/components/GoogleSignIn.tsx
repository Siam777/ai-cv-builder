"use client";

import { useEffect, useRef, useState } from "react";
import { accountRequest } from "@/lib/cloud-repository";

export function GoogleSignIn({
  mode = "signin",
  owner,
  disabled,
  beforeChange,
  onComplete,
  onWaitingChange,
}: {
  mode?: "signin" | "link";
  owner?: string;
  disabled?: boolean;
  beforeChange: () => Promise<void>;
  onComplete: () => Promise<void>;
  onWaitingChange?: (waiting: boolean) => void;
}) {
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const popup = useRef<Window | null>(null);
  const stop = useRef<() => void>(() => {});
  useEffect(
    () => () => {
      stop.current();
      popup.current?.close();
    },
    [],
  );

  function start() {
    setError("");
    // Open during the click gesture, before awaiting persistence or network work.
    const child = window.open("about:blank", "", "popup,width=520,height=680");
    if (!child) {
      setError(
        "Allow a sign-in window for this site, then try again. Your draft stays here.",
      );
      return;
    }
    popup.current = child;
    const flow = crypto.randomUUID();
    setWaiting(true);
    onWaitingChange?.(true);
    const startedAt = Date.now();
    let completing = false;
    let timer: ReturnType<typeof setInterval>;
    const cleanup = () => {
      window.removeEventListener("message", completed);
      clearInterval(timer);
      popup.current = null;
      setWaiting(false);
      onWaitingChange?.(false);
    };
    const completed = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== child ||
        event.data?.type !== "cv-google-complete" ||
        (event.data.flow !== flow && (event.data.flow || event.data.ok)) ||
        completing
      )
        return;
      completing = true;
      void (async () => {
        try {
          if (event.data.ok !== true)
            throw new Error(
              event.data.message ||
                "Google sign-in did not finish. Your draft is kept.",
            );
          await onComplete();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          child.close();
          cleanup();
        }
      })();
    };
    stop.current = cleanup;
    window.addEventListener("message", completed);
    timer = setInterval(() => {
      if (child.closed && !completing) {
        cleanup();
        setError(
          "The sign-in window closed. Your draft is kept; you can try again.",
        );
      } else if (Date.now() - startedAt >= 600_000 && !completing) {
        child.close();
        cleanup();
        setError(
          "This sign-in attempt expired. Your draft is kept; start Google sign-in again.",
        );
      }
    }, 500);
    void (async () => {
      try {
        await beforeChange();
        const result = (await accountRequest(
          "/api/auth/google",
          {
            method: "POST",
            body: JSON.stringify({ action: mode, flow }),
          },
          owner,
        )) as { url: string };
        if (child.closed) return;
        const url = new URL(result.url);
        if (url.origin !== "https://accounts.google.com")
          throw new Error("Could not start Google sign-in. Try again.");
        child.location.replace(url.href);
      } catch (e) {
        child.close();
        cleanup();
        setError((e as Error).message);
      }
    })();
  }

  return (
    <div className="google-auth">
      <button type="button" disabled={disabled || waiting} onClick={start}>
        {waiting
          ? "Waiting for Google…"
          : mode === "link"
            ? "Link Google"
            : owner
              ? "Sign in again with Google"
              : "Continue with Google"}
      </button>
      <p>Opens a separate window. Your editor and device drafts stay here.</p>
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
