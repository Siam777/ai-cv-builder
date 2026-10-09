export type PlanId = "free" | "job_hunter_monthly" | "job_hunter_weekly" | "lifetime";

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceFormatted: string;
  cadence: "month" | "week" | "one-time" | "free";
  features: string[];
  maxVariants: number;
  maxTailoredPerMonth: number;
  hasWatermark: boolean;
  allTemplates: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free / Local Tier",
    priceFormatted: "$0",
    cadence: "free",
    features: [
      "1 active resume variant",
      "Unlimited browser editing",
      "Standard PDF print export (with watermark)",
      "Plain-text (.txt) & JSON backup export",
    ],
    maxVariants: 1,
    maxTailoredPerMonth: 0,
    hasWatermark: true,
    allTemplates: false,
  },
  job_hunter_weekly: {
    id: "job_hunter_weekly",
    name: "Job Hunter Weekly Pass",
    priceFormatted: "$9 / week",
    cadence: "week",
    features: [
      "Unlimited resume variants",
      "1-Click Job Tailoring (50 applications/mo)",
      "Watermark-free PDF export",
      "All 4 designer templates (Classic, Modern, Compact, Creative)",
      "Master Career Vault & Evidence Matching",
    ],
    maxVariants: 100,
    maxTailoredPerMonth: 50,
    hasWatermark: false,
    allTemplates: true,
  },
  job_hunter_monthly: {
    id: "job_hunter_monthly",
    name: "Job Hunter Monthly Pass",
    priceFormatted: "$19 / month",
    cadence: "month",
    features: [
      "Everything in Weekly Pass",
      "Priority AI queue & Google XYZ Impact Coach",
      "Cloud sync across devices",
      "Cancel anytime in 1 click",
    ],
    maxVariants: 100,
    maxTailoredPerMonth: 50,
    hasWatermark: false,
    allTemplates: true,
  },
  lifetime: {
    id: "lifetime",
    name: "Lifetime Career Pass",
    priceFormatted: "$79 one-time",
    cadence: "one-time",
    features: [
      "Permanent Master Career Vault access",
      "Unlimited 1-Click Job Tailoring",
      "All present & future templates",
      "Lifetime watermark-free exports",
    ],
    maxVariants: 500,
    maxTailoredPerMonth: 200,
    hasWatermark: false,
    allTemplates: true,
  },
};
