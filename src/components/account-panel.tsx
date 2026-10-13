"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { accountRequest, importReceipts } from "@/lib/cloud-repository";
import {
  userCanExport,
  userSchema,
  type AccountUser,
} from "@/lib/cloud-contract";
import type { ResumeDocument } from "@/lib/document";
import { notifySessionChange, watchSessionChanges } from "@/lib/session-events";
import { GoogleSignIn } from "./GoogleSignIn";
import { X } from "lucide-react";

const sessionSchema = z.object({
  configured: z.boolean(),
  user: userSchema.nullable(),
  canDeleteAccount: z.boolean(),
  emailDelivery: z.enum(["file", "resend", "unconfigured"]).default("unconfigured"),
  googleConfigured: z.boolean().default(false),
  googleLinked: z.boolean().default(false),
  hasPassword: z.boolean().default(true),
});
type Session = z.infer<typeof sessionSchema>;
export function AccountPanel({
  cloudOwner,
  beforeChange,
  beforeNavigate = beforeChange,
  onLocal,
  onCloud,
  onSignedOut,
  loadLocal,
  onTransfer,
  onExport,
  onClose,
  onAuthenticated,
  pendingAction,
}: {
  cloudOwner: string | null;
  beforeChange: () => Promise<void>;
  beforeNavigate?: () => Promise<void>;
  onLocal: () => Promise<void>;
  onCloud: (user: AccountUser) => Promise<void>;
  onSignedOut: (deleted?: boolean) => Promise<void>;
  loadLocal: () => Promise<ResumeDocument[]>;
  onTransfer: (owner: string, documents: ResumeDocument[]) => Promise<string>;
  onExport: (owner: string) => Promise<void>;
  onClose: () => void;
  onAuthenticated?: (user: AccountUser) => Promise<void>;
  pendingAction?: string;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [action, setAction] = useState<"signin" | "signup" | "reset">("signin");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [localDocs, setLocalDocs] = useState<ResumeDocument[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [imported, setImported] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  async function refresh() {
    const value = sessionSchema.parse(await accountRequest("/api/account"));
    setSession(value);
    return value;
  }
  useEffect(() => {
    let active = true;
    void accountRequest("/api/account")
      .then((value) => {
        if (active) setSession(sessionSchema.parse(value));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    const state = new URLSearchParams(window.location.search).get("account");
    if (state === "recovery") setPasswordOpen(true);
    if (state === "verified")
      setMessage("Email confirmed. Choose Account workspace to continue.");
    if (state === "link-expired")
      setError(
        "This email link expired or was already used. Request a new link.",
      );
    if (state) window.history.replaceState(null, "", window.location.pathname);
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const stop = watchSessionChanges(() => {
      void accountRequest("/api/account").then(value => {
        if (!active) return;
        const next = sessionSchema.parse(value);
        setSession(previous => {
          if (previous?.user?.id !== next.user?.id) {
            setLocalDocs(null); setSelected([]); setImported([]); setPassword(""); setCurrentPassword(""); setDeleteOpen(false); setPasswordOpen(false);
          }
          return next;
        });
      }).catch(() => {});
    });
    return () => { active = false; stop(); };
  }, []);
  async function run(work: () => Promise<void>) {
    setWorking(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  const user = session?.user;
  return (
    <section
      className="account-panel no-print"
      aria-label="Account and storage"
    >
      <div className="account-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h2>Keep your next chapter close.</h2>
          <p>Choose where your resumes are saved.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={onClose}
            disabled={working}
            aria-label="Close account settings"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      </div>
      <nav className="account-navigation" aria-label="Account navigation">
        {[["/profile", "Profile"], ["/pricing", "Plans"], ["/help", "Help"], ["/privacy", "Data & privacy"]].map(([href, label]) =>
          <a key={href} href={href} onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            void run(async () => { await beforeNavigate(); window.location.assign(href); });
          }}>{label}</a>)}
      </nav>
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="account-message" aria-live="polite">
          {message}
        </p>
      )}
      {!session ? (
        <p>
          Checking account availability…{" "}
          <button
            onClick={() =>
              void run(async () => {
                await refresh();
              })
            }
          >
            Retry
          </button>
        </p>
      ) : (
        <>
          <div className="storage-options">
            <div
              className={!cloudOwner ? "storage-card active" : "storage-card"}
            >
              <strong>On this device</strong>
              <p>
                Private to this browser profile. Keep JSON backups before
                clearing browser data or changing devices.
              </p>
              <button
                disabled={working || !cloudOwner}
                onClick={() => void run(onLocal)}
              >
                {!cloudOwner ? "Current workspace" : "Open local workspace"}
              </button>
            </div>
            <div
              className={cloudOwner ? "storage-card active" : "storage-card"}
            >
              <strong>In your account</strong>
              <p>
                {session.configured
                  ? "Save resumes in your account. Signing in never uploads your local resumes automatically."
                  : "Account storage is not configured on this installation. Local editing is available; exporting requires sign-in."}
              </p>
              {user && (
                <>
                  <span className="account-email">{user.email}</span>
                  {pendingAction && onAuthenticated && <button className="primary" disabled={working || !userCanExport(user)} onClick={() => void run(() => onAuthenticated(user))}>{pendingAction}</button>}
                  <button
                    disabled={working || cloudOwner === user.id}
                    onClick={() => void run(() => onCloud(user))}
                  >
                    {cloudOwner === user.id
                      ? "Current workspace"
                      : "Open account workspace"}
                  </button>
                </>
              )}
            </div>
          </div>
          {session.configured && !user && <div className="account-signin-options">
            {session.googleConfigured ? <GoogleSignIn disabled={working} onWaitingChange={setWorking} beforeChange={beforeChange} onComplete={async () => {
              const next = await refresh();
              notifySessionChange();
              if (!next.user || !next.googleLinked) throw new Error("Google sign-in did not establish a session. Your draft is kept.");
              if (onAuthenticated) await onAuthenticated(next.user);
              setMessage("Signed in with Google. Choose your workspace; device drafts were kept.");
            }} /> : <p>Google sign-in is not configured on this installation. Use email and password below.</p>}
          </div>}
          {session.configured && !user && (
            <form
              className="account-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await beforeChange();
                  const result = (await accountRequest("/api/auth", {
                    method: "POST",
                    body: JSON.stringify({
                      action,
                      email,
                      ...(action !== "reset" ? { password } : {}),
                    }),
                  })) as { message?: string };
                  setPassword("");
                  const signedIn = await refresh();
                  notifySessionChange();
                  if (signedIn.user && onAuthenticated) await onAuthenticated(signedIn.user);
                  setMessage(result.message || (signedIn.user && !userCanExport(signedIn.user) ? "Signed in. Verify your email before exporting; your draft is kept." : "Request completed."));
                });
              }}
            >
              <h3>
                {action === "signup"
                  ? "Create an account"
                  : action === "reset"
                    ? "Reset your password"
                    : "Sign in"}
              </h3>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {action !== "reset" && (
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete={
                      action === "signup" ? "new-password" : "current-password"
                    }
                    required
                    minLength={action === "signup" ? 12 : 1}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              {action === "signup" && (
                <p>
                  Use at least 12 characters. Verify your email before exporting.
                </p>
              )}
              <div className="button-row">
                <button className="primary" disabled={working}>
                  {working
                    ? "Please wait…"
                    : action === "signup"
                      ? "Create account"
                      : action === "reset"
                        ? "Send recovery email"
                        : "Sign in"}
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => {
                    setAction(action === "signup" ? "signin" : "signup");
                    setPassword("");
                  }}
                >
                  {action === "signup"
                    ? "Already have an account?"
                    : "Create account instead"}
                </button>
                <button type="button" disabled={working} onClick={() => { setAction("reset"); setPassword(""); }}>Forgot password?</button>
              </div>
            </form>
          )}
          {user && (
            <>
              <div className="account-signin-options">
                <h3>Sign-in methods</h3>
                <p>{session.hasPassword ? "Email and password" : "Google sign-in · no password set"}{session.googleLinked && session.hasPassword ? " · Google linked" : ""}</p>
                {session.googleConfigured && <GoogleSignIn
                  mode={session.googleLinked ? "signin" : "link"} owner={user.id} onWaitingChange={setWorking}
                  disabled={working || (!session.googleLinked && !user.emailVerified)} beforeChange={beforeChange}
                  onComplete={async () => {
                    const next = await refresh(); notifySessionChange();
                    if (!next.user || next.user.id !== user.id || !next.googleLinked)
                      throw new Error("The signed-in account changed. Your original workspace draft is kept; restore its session or save a device copy before switching.");
                    if (onAuthenticated) await onAuthenticated(next.user);
                    setMessage(session.googleLinked ? "Google session refreshed. Your workspace was kept." : "Google linked to this account. Your CVs and email were kept.");
                  }} />}
                {!session.googleLinked && <p>Verify your email and sign in recently, then link the Google account with the same email. Accounts are not merged automatically.</p>}
              </div>
              <div className="account-verification">
                <p>{user.emailVerified ? "Email verified." : userCanExport(user) ? "You can download CVs and cover letters." : "Verify your email to download CVs and cover letters. You can keep editing and download your stored account data."}</p>
                {session.emailDelivery === "file" && <p>Local development uses a private email test outbox. No email is delivered.</p>}
                {!user.emailVerified && session.emailDelivery !== "unconfigured" && <button disabled={working} onClick={() => void run(async () => {
                  await accountRequest("/api/auth", { method: "POST", body: JSON.stringify({ action: "verify" }) }, user.id);
                  setMessage("Verification email requested. Open its link, then refresh verification status here.");
                })}>Send verification email</button>}
                <button disabled={working} onClick={() => void run(async () => {
                  const next = await refresh(); notifySessionChange();
                  setMessage(next.user?.emailVerified ? "Email verified. Continue your export when ready." : "Email is not verified yet. Open the link in your email.");
                })}>Refresh verification status</button>
              </div>
              <div className="account-actions">
                <button
                  disabled={working}
                  onClick={() =>
                    void run(async () => {
                      const docs = await loadLocal();
                      const receipts = await importReceipts(user.id);
                      setLocalDocs(docs);
                      setImported(receipts.map((r) => r.source_id));
                      setSelected([]);
                    })
                  }
                >
                  Review local resumes for import
                </button>
                <button
                  disabled={working}
                  onClick={() => void run(() => onExport(user.id))}
                >
                  Download account data
                </button>
                {session.hasPassword ? <button
                  disabled={working}
                  onClick={() => {
                    setPasswordOpen((value) => !value);
                    setPassword("");
                  }}
                >
                  Change password
                </button> : <button disabled={working || session.emailDelivery === "unconfigured"} onClick={() => void run(async () => {
                  await accountRequest("/api/auth", { method: "POST", body: JSON.stringify({ action: "reset", email: user.email }) });
                  setMessage("Password setup email requested. Use its recovery link to set a password; Google stays linked.");
                })}>Set a password by email</button>}
                <button
                  disabled={working}
                  onClick={() =>
                    void run(async () => {
                      await beforeChange();
                      await accountRequest("/api/auth", {
                        method: "POST",
                        body: JSON.stringify({ action: "signout" }),
                      });
                      notifySessionChange();
                      setSession({ ...session, user: null });
                      setLocalDocs(null);
                      setPassword("");
                      await onSignedOut();
                      setMessage(
                        "Signed out. Local resumes stay on this device.",
                      );
                    })
                  }
                >
                  Sign out
                </button>
              </div>
              {localDocs && (
                <div className="transfer-review">
                  <h3>Choose what to copy to {user.email}</h3>
                  <p>
                    Only selected resumes will be sent to your account. Local
                    originals remain unchanged. Previous imports are skipped,
                    including copies you later deleted. Duplicate a local resume
                    first if you want a new account copy.
                  </p>
                  {!localDocs.length && (
                    <p>No resumes saved on this device yet.</p>
                  )}
                  {localDocs.map((doc) => (
                    <label className="transfer-row" key={doc.id}>
                      <input
                        type="checkbox"
                        disabled={working || imported.includes(doc.id)}
                        checked={selected.includes(doc.id)}
                        onChange={(e) =>
                          setSelected((values) =>
                            e.target.checked
                              ? [...values, doc.id]
                              : values.filter((id) => id !== doc.id),
                          )
                        }
                      />
                      <span>
                        <strong>{doc.name}</strong>
                        <small>
                          {doc.sections.reduce(
                            (count, section) => count + section.entries.length,
                            0,
                          )}{" "}
                          entries ·{" "}
                          {imported.includes(doc.id)
                            ? "Previously imported"
                            : "Ready to copy"}
                        </small>
                      </span>
                    </label>
                  ))}
                  <div className="button-row">
                    <button
                      className="primary"
                      disabled={
                        working || !selected.length || selected.length > 20
                      }
                      onClick={() =>
                        void run(async () => {
                          const result = await onTransfer(
                            user.id,
                            localDocs.filter((doc) =>
                              selected.includes(doc.id),
                            ),
                          );
                          setImported(
                            (await importReceipts(user.id)).map(
                              (r) => r.source_id,
                            ),
                          );
                          setSelected([]);
                          setMessage(result);
                        })
                      }
                    >
                      Copy {selected.length} selected to account
                    </button>
                    <button
                      disabled={working}
                      onClick={() => setLocalDocs(null)}
                    >
                      Cancel
                    </button>
                  </div>
                  {selected.length > 20 && (
                    <p>Select no more than 20 resumes at a time.</p>
                  )}
                </div>
              )}
              {passwordOpen && (
                <form
                  className="account-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await accountRequest(
                        "/api/account/password",
                        {
                          method: "POST",
                          body: JSON.stringify({ password, currentPassword }),
                        },
                        user.id,
                      );
                      setPassword("");
                      setPasswordOpen(false);
                      setCurrentPassword("");
                      setMessage("Password updated.");
                      notifySessionChange();
                    });
                  }}
                >
                  <label>
                    Current password
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </label>
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
                  <button className="primary" disabled={working}>
                    Update password
                  </button>
                </form>
              )}
              <div className="account-deletion">
                <button
                  className="danger-link"
                  disabled={working || !session.canDeleteAccount}
                  onClick={() => {
                    setDeleteOpen((value) => !value);
                    setPassword("");
                    setConfirmation("");
                  }}
                >
                  Delete account and cloud resumes
                </button>
                {!session.canDeleteAccount && (
                  <p>
                    Account deletion has not been configured by the deployment
                    owner.
                  </p>
                )}
                {deleteOpen && (
                  <form
                    className="account-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await beforeChange();
                        await accountRequest(
                          "/api/account",
                          {
                            method: "DELETE",
                            body: JSON.stringify({ ...(session.hasPassword ? { password } : {}), confirmation }),
                          },
                          user.id,
                        );
                        setSession({ ...session, user: null });
                        notifySessionChange();
                        setDeleteOpen(false);
                        setLocalDocs(null);
                        setPassword("");
                        await onSignedOut(true);
                        setMessage(
                          "Account and active cloud resumes deleted. Local copies were kept.",
                        );
                      });
                    }}
                  >
                    <h3>Delete this account permanently?</h3>
                    <p>
                      This removes your login, cloud resumes, and import
                      receipts from active storage. Download account data first
                      if you need a copy. Local resumes stay in this browser.
                      Provider backups expire according to your deployment’s
                      retention policy.
                    </p>
                    {session.hasPassword ? <label>
                      Current password
                      <input
                        type="password"
                        autoComplete="current-password"
                        required
                        maxLength={128}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label> : <p>Sign in again with Google, then confirm deletion within ten minutes. No password is required for a Google-only account.</p>}
                    <label>
                      Type DELETE MY ACCOUNT
                      <input
                        required
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                      />
                    </label>
                    <button
                      className="danger-button"
                      disabled={working || confirmation !== "DELETE MY ACCOUNT"}
                    >
                      Permanently delete account
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
