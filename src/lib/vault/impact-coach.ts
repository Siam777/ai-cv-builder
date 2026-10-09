/**
 * Google XYZ Impact Coach:
 * "Accomplished [X], as measured by [Y], by doing [Z]"
 */

export interface BulletImpactAnalysis {
  text: string;
  hasMetric: boolean;
  hasActionVerb: boolean;
  isPassive: boolean;
  detectedMetric?: string;
  detectedActionVerb?: string;
  missingComponent: "metric" | "action" | "outcome" | null;
  score: number; // 0 to 100
  feedback: string;
}

export interface MetricTemplateOption {
  id: string;
  category: "latency" | "scale" | "cost" | "revenue" | "efficiency" | "custom";
  label: string;
  example: string;
  placeholder: string;
}

export const STRONG_ACTION_VERBS = new Set([
  "accelerated", "achieved", "architected", "automated", "built", "centralized",
  "championed", "collaborated", "conceived", "constructed", "created", "decreased",
  "delivered", "deployed", "designed", "developed", "devised", "eliminated",
  "engineered", "established", "executed", "expanded", "expedited", "formulated",
  "generated", "guided", "implemented", "improved", "increased", "initiated",
  "instituted", "integrated", "introduced", "launched", "led", "mentored",
  "maximized", "minimized", "modernized", "negotiated", "optimized", "orchestrated",
  "overhauled", "pioneered", "reduced", "reengineered", "refactored", "resolved",
  "revamped", "scaled", "simplified", "spearheaded", "standardized", "streamlined",
  "transformed", "upgraded"
]);

export const PASSIVE_PREFIXES = [
  /^responsible for/i,
  /^worked on/i,
  /^helped with/i,
  /^assisted in/i,
  /^assisted with/i,
  /^tasked with/i,
  /^involved in/i,
  /^participated in/i,
  /^contributed to/i,
  /^part of a team that/i,
];

export const METRIC_REGEX =
  /(?:\b\d+[\d,.]*\s*(?:%|\$|k|m|b|x|ms|s|seconds|minutes|hours|days|weeks|engineers|users|clients|customers|requests|rps|qps|queries|nodes|clusters|terabytes|gb|tb|stars|downloads|leads|sales)\b|\b\$\s*\d+[\d,.]*|\b\d+x\b|\b\d+[\d,.]*%\b)/i;

/**
 * Analyzes a bullet point for Google XYZ structure, action verbs, and quantitative metrics.
 */
export function analyzeBulletForImpact(bulletText: string): BulletImpactAnalysis {
  const text = bulletText.trim();
  if (!text) {
    return {
      text: "",
      hasMetric: false,
      hasActionVerb: false,
      isPassive: false,
      missingComponent: "action",
      score: 0,
      feedback: "Bullet is empty.",
    };
  }

  // 1. Check for passive phrasing
  const isPassive = PASSIVE_PREFIXES.some((pattern) => pattern.test(text));

  // 2. Check for metric [Y]
  const metricMatch = text.match(METRIC_REGEX);
  const hasMetric = Boolean(metricMatch);
  const detectedMetric = metricMatch ? metricMatch[0] : undefined;

  // 3. Check for action verb [Z]
  const firstWord = text.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
  const hasActionVerb = STRONG_ACTION_VERBS.has(firstWord);

  // Calculate impact score
  let score = 50;
  if (hasActionVerb) score += 20;
  if (hasMetric) score += 30;
  if (isPassive) score -= 30;
  score = Math.max(0, Math.min(100, score));

  // Determine feedback and missing components
  let missingComponent: BulletImpactAnalysis["missingComponent"] = null;
  let feedback = "Strong impact bullet!";

  if (isPassive) {
    missingComponent = "action";
    feedback =
      "Replace passive opener (e.g. 'Responsible for') with an active verb (e.g. 'Architected', 'Spearheaded').";
  } else if (!hasMetric) {
    missingComponent = "metric";
    feedback =
      "Add a measurable metric [Y] (e.g. % reduction in latency, $ savings, or user scale) to demonstrate impact.";
  } else if (!hasActionVerb) {
    missingComponent = "action";
    feedback = "Start with a punchy past-tense action verb (e.g. 'Delivered', 'Engineered').";
  }

  return {
    text,
    hasMetric,
    hasActionVerb,
    isPassive,
    detectedMetric,
    detectedActionVerb: hasActionVerb ? firstWord : undefined,
    missingComponent,
    score,
    feedback,
  };
}

/**
 * Returns prompt options for eliciting verified metrics from the candidate.
 */
export function getMetricPromptTemplates(): MetricTemplateOption[] {
  return [
    {
      id: "latency",
      category: "latency",
      label: "Time & Latency",
      example: "Reduced P99 query latency from 650ms to 85ms",
      placeholder: "e.g., cutting response latency by 45%",
    },
    {
      id: "scale",
      category: "scale",
      label: "Scale & Volume",
      example: "Scaled system to handle 2.5M daily active users",
      placeholder: "e.g., supporting 15,000 concurrent websocket connections",
    },
    {
      id: "cost",
      category: "cost",
      label: "Cost & Efficiency",
      example: "Decreased monthly cloud infrastructure costs by $18k (24%)",
      placeholder: "e.g., reducing monthly AWS RDS spend by 30%",
    },
    {
      id: "revenue",
      category: "revenue",
      label: "Revenue & Conversion",
      example: "Boosted checkout funnel conversion by 8.4%",
      placeholder: "e.g., driving $350k in incremental annual revenue",
    },
    {
      id: "efficiency",
      category: "efficiency",
      label: "Team Velocity / Time Saved",
      example: "Accelerated CI/CD build pipeline from 42 mins to 9 mins",
      placeholder: "e.g., saving engineers ~5 hours per week in manual triage",
    },
  ];
}

/**
 * Synthesizes a Google XYZ formatted accomplishment bullet
 * using the candidate's original text and their explicitly verified metric.
 * Strict Invariant: Does not invent or guess unverified numbers.
 */
export function synthesizeVerifiedXyzBullet(
  originalText: string,
  verifiedMetric: string,
  preferredVerb?: string,
): string {
  const cleanOriginal = originalText.trim().replace(/[.]+$/, "");
  const cleanMetric = verifiedMetric.trim().replace(/^[,\s]+|[,\s.]+$/g, "");

  if (!cleanMetric) return originalText;

  // Clean passive prefix from original
  let coreAction = cleanOriginal;
  for (const prefix of PASSIVE_PREFIXES) {
    coreAction = coreAction.replace(prefix, "").trim();
  }

  // Ensure first character of coreAction is lowercase if appended
  const verb = preferredVerb || inferActionVerb(cleanOriginal);

  // If the metric already starts with a participle (e.g., "reducing latency by 40%"), integrate cleanly
  if (/^(reducing|increasing|saving|scaling|cutting|boosting|improving|lowering|accelerating)/i.test(cleanMetric)) {
    return `${capitalize(verb)} ${coreAction}, ${cleanMetric}.`;
  }

  // If the metric is a noun phrase (e.g. "45% reduction in latency" or "$15k in monthly savings")
  return `${capitalize(verb)} ${coreAction}, resulting in ${cleanMetric}.`;
}

function inferActionVerb(text: string): string {
  const words = text.split(/\s+/);
  const first = words[0]?.toLowerCase().replace(/[^a-z]/g, "");
  if (STRONG_ACTION_VERBS.has(first)) {
    return words[0];
  }
  if (/design|ui|ux|mockup|prototype/i.test(text)) return "Designed";
  if (/build|develop|create|code/i.test(text)) return "Engineered";
  if (/optimize|speed|fast|perf/i.test(text)) return "Optimized";
  if (/manage|lead|mentor|direct/i.test(text)) return "Led";
  if (/auto|script|pipeline|ci/i.test(text)) return "Automated";
  return "Delivered";
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
