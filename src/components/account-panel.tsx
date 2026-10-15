"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { z } from "zod";
import { accountRequest, importReceipts } from "@/lib/cloud-repository";
import {
  userCanExport,
  userSchema,
  type AccountUser,
} from "@/lib/cloud-contract";
import type { ResumeDocument } from "@/lib/document";
import { PLANS, type PlanId } from "@/lib/billing-plans";
import { notifySessionChange, watchSessionChanges } from "@/lib/session-events";
import { GoogleSignIn } from "./GoogleSignIn";
import { TriangleAlert, X } from "lucide-react";

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

export const ACCOUNT_TABS = [
  ["profile", "Profile"],
  ["security", "Sign-in & security"],
  ["data", "Data & privacy"],
  ["billing", "Billing"],
] as const;
export type AccountTab = (typeof ACCOUNT_TABS)[number][0];

export function AccountPanel({
  cloudOwner,
  beforeChange,
  onCloud,
  onSignedOut,
  loadLocal,
  onTransfer,
  onExport,
  onClose,
  onAuthenticated,
  onOpenPricing,
  pendingAction,
  initialTab = "profile",
  headingLevel = 2,
}: {
  cloudOwner: string | null;
  beforeChange: () => Promise<void>;
  /** Opens the signed-in user's account CVs in the editor. */
  onCloud: (user: AccountUser) => Promise<void>;
  onSignedOut: (deleted?: boolean) => Promise<void>;
  loadLocal: () => Promise<ResumeDocument[]>;
  onTransfer: (owner: string, documents: ResumeDocument[]) => Promise<string>;
  onExport: (owner: string) => Promise<void>;
  /** Omitted on the full /profile page, which has no close button. */
  onClose?: () => void;
  onAuthenticated?: (user: AccountUser) => Promise<void>;
  /** Defaults to the /pricing page. */
  onOpenPricing?: () => void;
  pendingAction?: string;
  initialTab?: AccountTab;
  /** 1 on the standalone /profile page, 2 inside the editor dialog. */
  headingLevel?: 1 | 2;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<AccountTab>(initialTab);
  const [planId, setPlanId] = useState<PlanId | null>(null);
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
  const tabRefs = useRef<Partial<Record<AccountTab, HTMLButtonElement | null>>>({});
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
    if (state === "recovery") {
      setPasswordOpen(true);
      setTab("security");
    }
    if (state === "verified") setMessage("Email confirmed.");
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
            setLocalDocs(null); setSelected([]); setImported([]); setPassword(""); setCurrentPassword(""); setDeleteOpen(false); setPasswordOpen(false); setPlanId(null);
          }
          return next;
        });
      }).catch(() => {});
    });
    return () => { active = false; stop(); };
  }, []);
  const userId = session?.user?.id;
  useEffect(() => {
    if (tab !== "billing" || !userId || planId) return;
    let active = true;
    void fetch("/api/billing/subscription")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active) setPlanId((data?.subscription?.planId as PlanId) || "free");
      })
      .catch(() => {
        if (active) setPlanId("free");
      });
    return () => {
      active = false;
    };
  }, [tab, userId, planId]);
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
  function onTabKey(event: KeyboardEvent) {
    const index = ACCOUNT_TABS.findIndex(([id]) => id === tab);
    const last = ACCOUNT_TABS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    const id = ACCOUNT_TABS[next][0];
    setTab(id);
    tabRefs.current[id]?.focus();
  }
  const user = session?.user;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const signOut = () =>
    void run(async () => {
      if (!session) return;
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
      setMessage("Signed out. CVs saved in this browser stay here.");
    });
  return (
    <section
      className="account-panel no-print"
      aria-label="Account settings"
    >
      <div className="account-heading">
        <div>
          <Heading>{user ? "Account settings" : "Sign in"}</Heading>
          <p>
            {user
              ? user.email
              : "Sign in to keep your CVs in your account and download them."}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            disabled={working}
            aria-label="Close account settings"
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>
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
      ) : !session.configured ? (
        <p>
          Accounts are not set up on this installation. You can keep editing in
          this browser; downloads need an account.
        </p>
      ) : !user ? (
        <>
          <div className="account-signin-options">
            {session.googleConfigured ? <GoogleSignIn disabled={working} onWaitingChange={setWorking} beforeChange={beforeChange} onComplete={async () => {
              const next = await refresh();
              notifySessionChange();
              if (!next.user || !next.googleLinked) throw new Error("Google sign-in did not establish a session. Your draft is kept.");
              if (onAuthenticated) await onAuthenticated(next.user);
              setMessage("Signed in with Google. CVs saved in this browser were kept.");
            }} /> : <p>Google sign-in is not configured on this installation. Use email and password below.</p>}
          </div>
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
        </>
      ) : (
        <>
          {(pendingAction && onAuthenticated) || cloudOwner !== user.id ? (
            <div className="account-next-step button-row">
              {pendingAction && onAuthenticated && <button className="primary" disabled={working || !userCanExport(user)} onClick={() => void run(() => onAuthenticated(user))}>{pendingAction}</button>}
              {cloudOwner !== user.id && (
                <button disabled={working} onClick={() => void run(() => onCloud(user))}>
                  Open my account CVs
                </button>
              )}
            </div>
          ) : null}
          <div
            className="account-tabs"
            role="tablist"
            aria-label="Account sections"
            onKeyDown={onTabKey}
          >
            {ACCOUNT_TABS.map(([id, label]) => (
              <button
                key={id}
                ref={(node) => {
                  tabRefs.current[id] = node;
                }}
                type="button"
                role="tab"
                id={`account-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`account-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="account-tab-panel"
            role="tabpanel"
            id={`account-panel-${tab}`}
            aria-labelledby={`account-tab-${tab}`}
            tabIndex={0}
          >
            {tab === "profile" && (
              <>
                <div className="account-card">
                  <h3>Your account</h3>
                  <p className="account-email">{user.email}</p>
                  <p>
                    {cloudOwner === user.id
                      ? "Your CVs are saved to this account."
                      : "This tab is showing CVs saved in this browser."}
                  </p>
                </div>
                <div className="account-card account-verification">
                  <h3>Email</h3>
                  <p>{user.emailVerified ? "Email verified." : userCanExport(user) ? "You can download CVs and cover letters." : "Verify your email to download CVs and cover letters. You can keep editing and download your stored account data."}</p>
                  {session.emailDelivery === "file" && <p>Local development uses a private email test outbox. No email is delivered.</p>}
                  <div className="button-row">
                    {!user.emailVerified && session.emailDelivery !== "unconfigured" && <button disabled={working} onClick={() => void run(async () => {
                      await accountRequest("/api/auth", { method: "POST", body: JSON.stringify({ action: "verify" }) }, user.id);
                      setMessage("Verification email requested. Open its link, then refresh verification status here.");
                    })}>Send verification email</button>}
                    <button disabled={working} onClick={() => void run(async () => {
                      const next = await refresh(); notifySessionChange();
                      setMessage(next.user?.emailVerified ? "Email verified. Continue your export when ready." : "Email is not verified yet. Open the link in your email.");
                    })}>Refresh verification status</button>
                  </div>
                </div>
                <div className="account-card">
                  <button disabled={working} onClick={signOut}>
                    Sign out
                  </button>
                </div>
              </>
            )}
            {tab === "security" && (
              <>
                <div className="account-card account-signin-options">
                  <h3>Sign-in methods</h3>
                  <p>{session.hasPassword ? "Email and password" : "Google sign-in · no password set"}{session.googleLinked && session.hasPassword ? " · Google linked" : ""}</p>
                  {session.googleConfigured && <GoogleSignIn
                    mode={session.googleLinked ? "signin" : "link"} owner={user.id} onWaitingChange={setWorking}
                    disabled={working || (!session.googleLinked && !user.emailVerified)} beforeChange={beforeChange}
                    onComplete={async () => {
                      const next = await refresh(); notifySessionChange();
                      if (!next.user || next.user.id !== user.id || !next.googleLinked)
                        throw new Error("The signed-in account changed. Your original draft is kept; restore its session or save a copy in this browser before switching.");
                      if (onAuthenticated) await onAuthenticated(next.user);
                      setMessage(session.googleLinked ? "Google session refreshed. Your CVs were kept." : "Google linked to this account. Your CVs and email were kept.");
                    }} />}
                  {!session.googleLinked && <p>Verify your email and sign in recently, then link the Google account with the same email. Accounts are not merged automatically.</p>}
                </div>
                <div className="account-card">
                  <h3>Password</h3>
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
                </div>
              </>
            )}
            {tab === "data" && (
              <>
                <div className="account-card">
                  <h3>CVs saved in this browser</h3>
                  <p>
                    Copy CVs from this browser into your account. The copies in
                    this browser stay as they are.
                  </p>
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
                    Choose CVs to copy
                  </button>
                  {localDocs && (
                    <TransferList
                      email={user.email}
                      documents={localDocs}
                      imported={imported}
                      selected={selected}
                      working={working}
                      onSelect={setSelected}
                      onCancel={() => setLocalDocs(null)}
                      onCopy={() =>
                        void run(async () => {
                          const result = await onTransfer(
                            user.id,
                            localDocs.filter((doc) => selected.includes(doc.id)),
                          );
                          setImported(
                            (await importReceipts(user.id)).map((r) => r.source_id),
                          );
                          setSelected([]);
                          setMessage(result);
                        })
                      }
                    />
                  )}
                </div>
                <div className="account-card">
                  <h3>Your data</h3>
                  <p>
                    Download everything stored in your account as a JSON file.
                    AI requests are only sent with your consent.{" "}
                    <a href="/privacy">Read the privacy notice</a>.
                  </p>
                  <button
                    disabled={working}
                    onClick={() => void run(() => onExport(user.id))}
                  >
                    Download account data
                  </button>
                </div>
                <div className="account-card account-danger-zone" role="group" aria-labelledby="account-danger-heading">
                  <h3 id="account-danger-heading">
                    <TriangleAlert size={16} aria-hidden /> Danger zone
                  </h3>
                  <p>
                    Deleting your account removes your login and the CVs saved
                    to it. This cannot be undone.
                  </p>
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
            {tab === "billing" && (
              <div className="account-card">
                <h3>Your plan</h3>
                <p>
                  {planId
                    ? `Current plan: ${PLANS[planId]?.name ?? PLANS.free.name}`
                    : "Checking your plan…"}
                </p>
                <button
                  className="primary"
                  disabled={working}
                  onClick={() =>
                    onOpenPricing ? onOpenPricing() : window.location.assign("/pricing")
                  }
                >
                  See plans
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Pick browser CVs to copy into the account. Previous copies are skipped. */
export function TransferList({
  email,
  documents,
  imported,
  selected,
  working,
  onSelect,
  onCopy,
  onCancel,
}: {
  email: string;
  documents: ResumeDocument[];
  imported: string[];
  selected: string[];
  working: boolean;
  onSelect: (ids: string[]) => void;
  onCopy: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="transfer-review">
      <h3>Choose what to copy to {email}</h3>
      <p>
        Only the CVs you tick are copied. The copies in this browser stay as
        they are. CVs you copied before are skipped, even if you later deleted
        them from your account; duplicate one first if you want a new copy.
      </p>
      {!documents.length && <p>No CVs are saved in this browser.</p>}
      {documents.map((doc) => (
        <label className="transfer-row" key={doc.id}>
          <input
            type="checkbox"
            disabled={working || imported.includes(doc.id)}
            checked={selected.includes(doc.id)}
            onChange={(e) =>
              onSelect(
                e.target.checked
                  ? [...selected, doc.id]
                  : selected.filter((id) => id !== doc.id),
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
              {imported.includes(doc.id) ? "Previously imported" : "Ready to copy"}
            </small>
          </span>
        </label>
      ))}
      <div className="button-row">
        <button
          className="primary"
          disabled={working || !selected.length || selected.length > 20}
          onClick={onCopy}
        >
          Copy {selected.length} selected to account
        </button>
        <button disabled={working} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {selected.length > 20 && <p>Select no more than 20 CVs at a time.</p>}
    </div>
  );
}
