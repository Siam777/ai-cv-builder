"use client";
import { useEffect, useRef, useState } from "react";
import { accountRequest } from "@/lib/cloud-repository";
import { notifySessionChange } from "@/lib/session-events";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [working, setWorking] = useState(false);
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const query = new URLSearchParams(window.location.search);
    setToken(query.get("token") || "");
    if (query.has("error") || !query.get("token"))
      setMessage(
        "This recovery link is invalid or expired. Request another email from Account settings.",
      );
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  return (
    <main className="account-panel">
      <h1>Reset your password</h1>
      <p>
        Existing editor drafts stay in their tabs. Resetting your password signs
        out all account sessions.
      </p>
      {message && <p role={done ? "status" : "alert"}>{message}</p>}
      {token && !done && (
        <form
          className="account-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (password !== confirmation) {
              setMessage("Passwords must match.");
              return;
            }
            setWorking(true);
            try {
              await accountRequest("/api/auth", {
                method: "POST",
                body: JSON.stringify({
                  action: "complete-reset",
                  token,
                  password,
                }),
              });
              setToken("");
              setPassword("");
              setConfirmation("");
              setDone(true);
              notifySessionChange();
              setMessage(
                "Password reset. Sign in again in your existing editor tab to continue.",
              );
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setWorking(false);
            }
          }}
        >
          <label>
            New password
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button disabled={working}>Reset password</button>
        </form>
      )}
      <a href="/profile">Account settings</a>
    </main>
  );
}
