import { PLANS, type PlanId } from "./billing-plans";

/** AI Assistant features that depend on the plan. */
export type PlanGatedFeature = "tailored-copy";

const LOCKED_COPY: Record<
  PlanGatedFeature,
  { title: string; reason: string }
> = {
  "tailored-copy": {
    title: "Tailored CV copies",
    reason:
      "The comparison is free. Saving a tailored copy of your CV for this job is part of the Job Hunter Pass.",
  },
};

/** Whether a plan includes a feature. Mirrors the limits in PLANS. */
export function planAllows(planId: PlanId, feature: PlanGatedFeature): boolean {
  const plan = PLANS[planId] ?? PLANS.free;
  switch (feature) {
    case "tailored-copy":
      return plan.maxTailoredPerMonth > 0;
  }
}

export function lockedCopy(feature: PlanGatedFeature) {
  return LOCKED_COPY[feature];
}

export type RewriteStatus =
  | "checking"
  | "unreachable"
  | "account-needed"
  | "browser-cv"
  | "session-expired"
  | "not-configured"
  | "ready";

/**
 * Whether the AI rewrite (a server request) can run. It needs an account CV, a
 * live session and a provider configured on this installation.
 */
export function rewriteStatus(
  owner: string | null,
  availability: { configured: boolean; signedIn: boolean } | "unreachable" | null,
  /** Signed in, even if the open CV is still the copy saved in this browser. */
  signedIn = false,
): RewriteStatus {
  if (!owner) return signedIn ? "browser-cv" : "account-needed";
  if (!availability) return "checking";
  if (availability === "unreachable") return "unreachable";
  if (!availability.configured) return "not-configured";
  if (!availability.signedIn) return "session-expired";
  return "ready";
}

export const REWRITE_STATUS_TEXT: Record<RewriteStatus, string> = {
  checking: "Checking whether AI rewriting is available…",
  unreachable:
    "Could not check whether AI rewriting is available. Check your connection and reopen this menu.",
  "account-needed":
    "AI rewriting works on CVs saved to your account. Sign in to use it. The other options work without it.",
  "browser-cv":
    "You are signed in, but this CV is still saved only in this browser. Copy it to your account to use AI rewriting. The other options work without it.",
  "session-expired":
    "Your sign-in has expired. Sign in again to use AI rewriting.",
  "not-configured":
    "AI rewriting is not set up on this installation. The other options work without it.",
  ready: "AI rewriting is ready. You review every change before it is applied.",
};
