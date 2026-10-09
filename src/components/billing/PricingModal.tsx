"use client";

import { useState } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { PLANS, type PlanId } from "@/lib/billing-plans";
import type { AccountUser } from "@/lib/cloud-contract";

export interface PricingModalProps {
  cloudUser: AccountUser | null;
  currentPlanId?: PlanId;
  onOpenAccount: () => void;
  onClose: () => void;
}

export function PricingModal({
  cloudUser,
  currentPlanId = "free",
  onOpenAccount,
  onClose,
}: PricingModalProps) {
  useBodyScrollLock(true);
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");

  async function handleCheckout(planId: PlanId) {
    if (!cloudUser) {
      onOpenAccount();
      onClose();
      return;
    }

    setLoadingPlan(planId);
    setError("");

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to start checkout session.");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      setError((e as Error).message);
      setLoadingPlan(null);
    }
  }

  return (
    <div className="modal-backdrop no-print" role="dialog" aria-label="Subscription Pricing">
      <div className="modal-card pricing-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">ACTIVE JOB HUNTER PASS · PRICING & TIERS</p>
            <h2>Land interviews faster with evidence-grounded tailoring</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close pricing dialog"
          >
            ✕
          </button>
        </header>

        <div className="pricing-content">
          {error && <div className="alert" role="alert">{error}</div>}

          <div className="pricing-grid">
            {/* Free Tier */}
            <div className={`pricing-card ${currentPlanId === "free" ? "current" : ""}`}>
              <div className="card-top">
                <span className="plan-badge">FREE FOREVER</span>
                <h3>Free / Local</h3>
                <div className="plan-price">
                  <span className="price-val">$0</span>
                </div>
                <p className="plan-sub">Perfect for building a baseline resume locally.</p>
              </div>
              <ul className="plan-features">
                <li>✓ 1 active resume variant</li>
                <li>✓ Unlimited browser editing & autosave</li>
                <li>✓ Standard PDF print export (with watermark)</li>
                <li>✓ Plain-text & JSON backup export</li>
                <li className="dimmed">✗ 1-Click Job Description Tailoring</li>
                <li className="dimmed">✗ Watermark-free PDF exports</li>
              </ul>
              <button
                type="button"
                disabled
                className="plan-button outline"
              >
                {currentPlanId === "free" ? "Current Plan" : "Included"}
              </button>
            </div>

            {/* Job Hunter Monthly - Popular */}
            <div className={`pricing-card featured ${currentPlanId === "job_hunter_monthly" ? "current" : ""}`}>
              <div className="popular-ribbon">MOST POPULAR</div>
              <div className="card-top">
                <span className="plan-badge featured-badge">JOB HUNTER PASS</span>
                <h3>Monthly Pass</h3>
                <div className="plan-price">
                  <span className="price-val">$19</span>
                  <span className="price-period">/ month</span>
                </div>
                <p className="plan-sub">For active candidates targeting multiple job applications.</p>
              </div>
              <ul className="plan-features">
                <li>✓ <strong>Unlimited</strong> resume variants</li>
                <li>✓ <strong>1-Click Job Tailoring</strong> (50 tailored apps/mo)</li>
                <li>✓ <strong>Clean, watermark-free</strong> PDF & DOCX export</li>
                <li>✓ All 4 designer templates (Classic, Modern, Compact, Creative)</li>
                <li>✓ Master Career Vault & Google XYZ Impact Coach</li>
                <li>✓ Cancel anytime in 1 click</li>
              </ul>
              <button
                type="button"
                className="plan-button primary"
                disabled={loadingPlan !== null || currentPlanId === "job_hunter_monthly"}
                onClick={() => handleCheckout("job_hunter_monthly")}
              >
                {loadingPlan === "job_hunter_monthly"
                  ? "Redirecting…"
                  : currentPlanId === "job_hunter_monthly"
                  ? "Active Plan"
                  : "Upgrade to Job Hunter Pass ↗"}
              </button>
            </div>

            {/* Lifetime Pass */}
            <div className={`pricing-card ${currentPlanId === "lifetime" ? "current" : ""}`}>
              <div className="card-top">
                <span className="plan-badge">LIFETIME ACCESS</span>
                <h3>Power Pass</h3>
                <div className="plan-price">
                  <span className="price-val">$79</span>
                  <span className="price-period">one-time</span>
                </div>
                <p className="plan-sub">For senior professionals maintaining long-term career records.</p>
              </div>
              <ul className="plan-features">
                <li>✓ <strong>Permanent</strong> Master Career Vault storage</li>
                <li>✓ <strong>Unlimited</strong> 1-Click Job Tailoring</li>
                <li>✓ All present & future template families</li>
                <li>✓ Lifetime clean watermark-free exports</li>
                <li>✓ Priority AI response queue</li>
              </ul>
              <button
                type="button"
                className="plan-button primary dark"
                disabled={loadingPlan !== null || currentPlanId === "lifetime"}
                onClick={() => handleCheckout("lifetime")}
              >
                {loadingPlan === "lifetime"
                  ? "Redirecting…"
                  : currentPlanId === "lifetime"
                  ? "Active Plan"
                  : "Get Lifetime Pass ↗"}
              </button>
            </div>
          </div>
        </div>

        <div className="button-row">
          <p className="secure-badge">🔒 256-bit encrypted checkout via Stripe</p>
          <a
            href="/upgrade"
            style={{
              fontSize: "11px",
              color: "var(--green)",
              fontWeight: 600,
              textDecoration: "underline",
              marginRight: "auto",
            }}
          >
            Open full comparison & pricing page ↗
          </a>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
