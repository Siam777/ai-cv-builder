"use client";

import { Check, Minus } from "lucide-react";
import { PLANS, type PaidPlanId, type PlanConfig, type PlanId } from "@/lib/billing-plans";

const ORDER: PlanId[] = ["free", "go", "pro"];

/** The three plan cards, shared by the pricing dialog and /upgrade. */
export function PlanCards({
  currentPlanId,
  beta = false,
  loadingPlan,
  onChoose,
}: {
  currentPlanId: PlanId;
  /** The current plan is the beta's free Go period. */
  beta?: boolean;
  loadingPlan: PlanId | null;
  onChoose: (planId: PaidPlanId) => void;
}) {
  return (
    <div className="pricing-grid plan-cards">
      {ORDER.map((id) => {
        const plan = PLANS[id];
        const current = currentPlanId === id;
        const [amount, period] = plan.priceFormatted.split(" / ");
        return (
          <div
            key={id}
            className={`pricing-card${id === "go" ? " featured" : ""}${current ? " current" : ""}`}
            aria-label={`${plan.name} plan`}
            role="group"
          >
            {id === "go" && <div className="popular-ribbon">Most popular</div>}
            <div className="card-top">
              <span className={`plan-badge${id === "go" ? " featured-badge" : ""}`}>
                {plan.tagline}
              </span>
              <h3>{plan.name}</h3>
              <div className="plan-price">
                <span className="price-val">{amount}</span>
                {period && <span className="price-period">/ {period}</span>}
              </div>
            </div>
            <ul className="plan-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={16} aria-hidden /> {feature}
                </li>
              ))}
            </ul>
            {id === "free" ? (
              <button type="button" disabled className="plan-button outline">
                {current ? "Current plan" : "Included"}
              </button>
            ) : (
              <button
                type="button"
                className={`plan-button primary${id === "pro" ? " dark" : ""}`}
                disabled={loadingPlan !== null || (current && !beta)}
                onClick={() => onChoose(id)}
              >
                {loadingPlan === id
                  ? "Redirecting…"
                  : current
                    ? beta
                      ? `Keep ${plan.name} after the beta`
                      : "Current plan"
                    : `Choose ${plan.name}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Row = { label: string; value: (plan: PlanConfig) => string | boolean };

const ROWS: Row[] = [
  { label: "Editor, Check my CV and all 12 designs", value: () => true },
  { label: "Built-in writing helpers", value: () => true },
  { label: "AI requests a day (all AI actions)", value: (p) => String(p.aiRequestsPerDay) },
  { label: "Bullets from your notes, examples, wording fixes", value: (p) => p.aiEntryBullets },
  {
    label: "Build my CV with AI (interviews)",
    value: (p) => (p.aiInterviews === Infinity ? "Unlimited" : String(p.aiInterviews)),
  },
  { label: "AI summary drafts", value: (p) => p.aiSummaryDrafts },
  { label: "Suggest skills with AI", value: (p) => p.aiSkills },
  { label: "Ask the AI", value: (p) => p.aiAsk },
  { label: "Match a job post with AI", value: (p) => p.aiJobMatch },
  { label: "Improve all bullets", value: (p) => p.aiImproveAll },
  { label: "Tidy imported CVs with AI", value: (p) => p.aiImportTidy },
  { label: "Watermark-free downloads", value: (p) => !p.hasWatermark },
  {
    label: "Tailored CV copies a month",
    value: (p) =>
      p.maxTailoredPerMonth === Infinity
        ? "Unlimited"
        : p.maxTailoredPerMonth
          ? String(p.maxTailoredPerMonth)
          : false,
  },
  { label: "Cover letters", value: (p) => p.coverLetters },
  { label: "Write a cover letter with AI", value: (p) => p.aiCoverLetter },
  { label: "Tailor with AI", value: (p) => p.aiTailor },
  { label: "AI job coaching", value: (p) => p.jobCoaching },
];

/** Feature comparison generated from the plan configuration. */
export function PlanComparison() {
  return (
    <div className="table-responsive">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Feature</th>
            {ORDER.map((id) => (
              <th key={id} className={id === "go" ? "highlight-col" : undefined}>
                {PLANS[id].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              {ORDER.map((id) => {
                const value = row.value(PLANS[id]);
                return (
                  <td key={id} className={id === "go" ? "highlight-col" : undefined}>
                    {value === true ? (
                      <>
                        <Check size={16} aria-hidden />
                        <span className="sr-only">Included</span>
                      </>
                    ) : value === false ? (
                      <>
                        <Minus size={16} aria-hidden />
                        <span className="sr-only">Not included</span>
                      </>
                    ) : (
                      value
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
