/** The three monthly tiers. Old plan IDs map to these through `normalizePlanId`. */
export type PlanId = "free" | "go" | "pro";

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceFormatted: string;
  /** Monthly price in US cents; 0 for Free. */
  priceCents: number;
  cadence: "month" | "free";
  tagline: string;
  features: string[];
  maxVariants: number;
  /** Tailored CV copies per month; `Infinity` means unlimited. */
  maxTailoredPerMonth: number;
  hasWatermark: boolean;
  allTemplates: boolean;
  /** AI rewrite and draft requests per day (the installation cap still applies). */
  aiRequestsPerDay: number;
  /** AI-drafted professional summaries. */
  aiSummaryDrafts: boolean;
  /** Cover letter tool in the AI Assistant. */
  coverLetters: boolean;
  /** AI coaching against a job's criteria. */
  jobCoaching: boolean;
  /** Write with AI on a job or project: bullets from the person's notes. */
  aiEntryBullets: boolean;
  /** Example bullets, summary and skills for a job title, with blanks to fill. */
  aiStarters: boolean;
  /** Suggest skills with AI: skills the CV shows, common ones for the role, grouping. */
  aiSkills: boolean;
  /** AI interview starts allowed in total; `Infinity` means unlimited. */
  aiInterviews: number;
  /** Improve all bullets of a job in one request. */
  aiImproveAll: boolean;
  /** Match a job post with AI: requirements, shown evidence, gaps. */
  aiJobMatch: boolean;
  /** Tailor with AI: a reworded summary and bullets saved as a tailored copy. */
  aiTailor: boolean;
  /** Write a cover letter with AI from the CV. */
  aiCoverLetter: boolean;
  /** Tidy with AI after an import: structure only. */
  aiImportTidy: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    priceFormatted: "$0",
    priceCents: 0,
    cadence: "free",
    tagline: "Build and check a CV",
    features: [
      "Full editor and all 12 designs",
      "Check my CV and built-in writing helpers",
      "5 AI rewrites a day",
      "PDF download with a small watermark",
    ],
    maxVariants: 1,
    maxTailoredPerMonth: 0,
    hasWatermark: true,
    allTemplates: true,
    aiRequestsPerDay: 5,
    aiSummaryDrafts: false,
    coverLetters: false,
    jobCoaching: false,
    aiEntryBullets: true,
    aiStarters: true,
    aiSkills: false,
    aiInterviews: 1,
    aiImproveAll: false,
    aiJobMatch: false,
    aiTailor: false,
    aiCoverLetter: false,
    aiImportTidy: false,
  },
  go: {
    id: "go",
    name: "Go",
    priceFormatted: "$9.99 / month",
    priceCents: 999,
    cadence: "month",
    tagline: "For an active job search",
    features: [
      "Everything in Free",
      "No watermark on downloads",
      "50 AI rewrites a day",
      "AI summary drafts from your CV",
      "20 tailored CV copies a month",
      "Cover letters",
    ],
    maxVariants: 100,
    maxTailoredPerMonth: 20,
    hasWatermark: false,
    allTemplates: true,
    aiRequestsPerDay: 50,
    aiSummaryDrafts: true,
    coverLetters: true,
    jobCoaching: false,
    aiEntryBullets: true,
    aiStarters: true,
    aiSkills: true,
    aiInterviews: Infinity,
    aiImproveAll: true,
    aiJobMatch: true,
    aiTailor: false,
    aiCoverLetter: true,
    aiImportTidy: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceFormatted: "$29.99 / month",
    priceCents: 2999,
    cadence: "month",
    tagline: "For many applications",
    features: [
      "Everything in Go",
      "200 AI rewrites a day",
      "Unlimited tailored CV copies",
      "AI job coaching for each requirement",
    ],
    maxVariants: 500,
    maxTailoredPerMonth: Infinity,
    hasWatermark: false,
    allTemplates: true,
    aiRequestsPerDay: 200,
    aiSummaryDrafts: true,
    coverLetters: true,
    jobCoaching: true,
    aiEntryBullets: true,
    aiStarters: true,
    aiSkills: true,
    aiInterviews: Infinity,
    aiImproveAll: true,
    aiJobMatch: true,
    aiTailor: true,
    aiCoverLetter: true,
    aiImportTidy: true,
  },
};

export const PAID_PLAN_IDS = ["go", "pro"] as const;
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

/** Plan IDs stored before the Free / Go / Pro tiers. */
const LEGACY_PLAN_IDS: Record<string, PlanId> = {
  job_hunter_weekly: "go",
  job_hunter_monthly: "go",
  lifetime: "pro",
};

/** Maps any stored plan ID (including old ones) to a current plan. */
export function normalizePlanId(value: unknown): PlanId {
  const id = String(value ?? "");
  if (id in PLANS) return id as PlanId;
  return LEGACY_PLAN_IDS[id] ?? "free";
}

/** Days of free Go access after sign-up during the beta (0 turns it off). */
export function betaTrialDays(env: Record<string, string | undefined> = process.env) {
  const raw = env.BETA_GO_TRIAL_DAYS;
  if (raw === undefined || raw === "") return 30;
  return /^\d+$/.test(raw) ? Math.min(Number(raw), 365) : 30;
}
