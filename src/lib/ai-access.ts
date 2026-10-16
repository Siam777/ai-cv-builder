import { PLANS, type PlanId } from "./billing-plans";

/** Features that depend on the plan. */
export type PlanGatedFeature =
  | "tailored-copy"
  | "cover-letter"
  | "job-coaching"
  | "ai-summary"
  | "ai-entry-bullets"
  | "ai-starters"
  | "ai-skills"
  | "ai-interview";

const LOCKED_COPY: Record<
  PlanGatedFeature,
  { title: string; reason: string }
> = {
  "tailored-copy": {
    title: "Tailored CV copies",
    reason:
      "The comparison is free. Saving a tailored copy of your CV for this job is part of Go and Pro.",
  },
  "cover-letter": {
    title: "Cover letters",
    reason: "Writing a cover letter from your CV is part of Go and Pro.",
  },
  "job-coaching": {
    title: "AI job coaching",
    reason:
      "Coaching each requirement against your CV is part of Pro. The job comparison itself stays free.",
  },
  "ai-summary": {
    title: "AI summary drafts",
    reason:
      "Drafting your summary with AI is part of Go and Pro. The quick draft below works on every plan.",
  },
  "ai-entry-bullets": {
    title: "Write with AI",
    reason: "Writing bullets from your notes is not part of your plan.",
  },
  "ai-starters": {
    title: "Examples for your job title",
    reason: "Examples for your job title are not part of your plan.",
  },
  "ai-skills": {
    title: "Suggest skills with AI",
    reason:
      "Suggesting skills from your CV with AI is part of Go and Pro. Add skills from my CV works on every plan.",
  },
  "ai-interview": {
    title: "Build my CV with AI",
    reason: "Free includes one AI interview. Go and Pro include as many as you need.",
  },
};

/** Whether a plan includes a feature. Mirrors the limits in PLANS. */
export function planAllows(planId: PlanId, feature: PlanGatedFeature): boolean {
  const plan = PLANS[planId] ?? PLANS.free;
  switch (feature) {
    case "tailored-copy":
      return plan.maxTailoredPerMonth > 0;
    case "cover-letter":
      return plan.coverLetters;
    case "job-coaching":
      return plan.jobCoaching;
    case "ai-summary":
      return plan.aiSummaryDrafts;
    case "ai-entry-bullets":
      return plan.aiEntryBullets;
    case "ai-starters":
      return plan.aiStarters;
    case "ai-skills":
      return plan.aiSkills;
    case "ai-interview":
      return plan.aiInterviews > 0;
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
