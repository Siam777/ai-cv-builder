"use client";

import { useState } from "react";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { PLANS, type PlanId } from "@/lib/billing-plans";
import type { AccountUser } from "@/lib/cloud-contract";
import { Check, X } from "lucide-react";

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
  const dialogRef = useModalFocus(onClose);
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
        throw new Error(
          data.error === "BILLING_NOT_CONFIGURED"
            ? "Payments are not configured on this installation. You can keep using the editor."
            : data.error || "Unable to start checkout session.",
        );
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
    <div
      className="modal-backdrop no-print"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Subscription Pricing"
    >
      <div className="modal-card pricing-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Proposed plans & configured limits</p>
            <h2>Review plans and current limits</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close pricing dialog"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="pricing-content">
          <p className="helper-text">
            These are proposed paid plans. Payment services and some paid
            features still need integration and live validation. Device editing
            includes multiple drafts and twelve current designs. CV downloads
            require sign-in and verified email.
          </p>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}

          <div className="pricing-grid">
            {/* Free Tier */}
            <div
              className={`pricing-card ${currentPlanId === "free" ? "current" : ""}`}
            >
              <div className="card-top">
                <span className="plan-badge">Device editing</span>
                <h3>Free / Local</h3>
                <div className="plan-price">
                  <span className="price-val">$0</span>
                </div>
                <p className="plan-sub">
                  Perfect for building a baseline resume locally.
                </p>
              </div>
              <ul className="plan-features">
                <li><Check size={16} aria-hidden /> Multiple independent device drafts</li>
                <li><Check size={16} aria-hidden /> Unlimited browser editing & autosave</li>
                <li><Check size={16} aria-hidden /> Standard PDF print export (with watermark)</li>
                <li><Check size={16} aria-hidden /> Plain-text & JSON backup export</li>
                <li className="dimmed"><Check size={16} aria-hidden /> Local rule-based job tailoring</li>
                <li className="dimmed"><X size={16} aria-hidden /> Watermark-free PDF exports</li>
              </ul>
              <button type="button" disabled className="plan-button outline">
                {currentPlanId === "free" ? "Current Plan" : "Included"}
              </button>
            </div>

            {/* Job Hunter Monthly - Popular */}
            <div
              className={`pricing-card featured ${currentPlanId === "job_hunter_monthly" ? "current" : ""}`}
            >
              <div className="popular-ribbon">Monthly plan</div>
              <div className="card-top">
                <span className="plan-badge featured-badge">
                  JOB HUNTER PASS
                </span>
                <h3>Monthly Pass</h3>
                <div className="plan-price">
                  <span className="price-val">$19</span>
                  <span className="price-period">/ month</span>
                </div>
                <p className="plan-sub">
                  For active candidates targeting multiple job applications.
                </p>
              </div>
              <ul className="plan-features">
                <li>
                  Configured cap:{" "}
                  <strong>{PLANS.job_hunter_monthly.maxVariants}</strong>{" "}
                  account variants
                </li>
                <li>
                  Configured cap:{" "}
                  <strong>
                    {PLANS.job_hunter_monthly.maxTailoredPerMonth}
                  </strong>{" "}
                  tailoring uses/month
                </li>
                <li>
                  <Check size={16} aria-hidden /> <strong>Clean, watermark-free</strong> PDF & DOCX export
                </li>
                <li>Eight current editor designs</li>
                <li><Check size={16} aria-hidden /> Master Career Vault & Google XYZ Impact Coach</li>
                <li>Cancellation flow requires live validation</li>
              </ul>
              <button
                type="button"
                className="plan-button primary"
                disabled={
                  loadingPlan !== null || currentPlanId === "job_hunter_monthly"
                }
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
            <div
              className={`pricing-card ${currentPlanId === "lifetime" ? "current" : ""}`}
            >
              <div className="card-top">
                <span className="plan-badge">One-time plan</span>
                <h3>Power Pass</h3>
                <div className="plan-price">
                  <span className="price-val">$79</span>
                  <span className="price-period">one-time</span>
                </div>
                <p className="plan-sub">
                  For senior professionals maintaining long-term career records.
                </p>
              </div>
              <ul className="plan-features">
                <li>One-time plan configuration</li>
                <li>
                  Configured cap:{" "}
                  <strong>{PLANS.lifetime.maxTailoredPerMonth}</strong>{" "}
                  tailoring uses/month
                </li>
                <li>Eight current editor designs</li>
                <li><Check size={16} aria-hidden /> Watermark-free PDF/DOCX while entitlement is active</li>
                <li>Provider features await live validation</li>
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
                    : "Review Power Pass ↗"}
              </button>
            </div>
          </div>
        </div>

        <div className="button-row">
          <p className="secure-badge">
            Checkout requires configured payment services
          </p>
          <a
            href="/upgrade"
            style={{
              fontSize: "var(--text-xs)",
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
