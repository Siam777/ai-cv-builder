"use client";

import { useState } from "react";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { PaidPlanId, PlanId } from "@/lib/billing-plans";
import type { AccountUser } from "@/lib/cloud-contract";
import { X } from "lucide-react";
import { PlanCards } from "./PlanCards";

export interface PricingModalProps {
  cloudUser: AccountUser | null;
  currentPlanId?: PlanId;
  /** The current plan is the beta's free Go period. */
  beta?: boolean;
  /** Days of free Go for new accounts (0 when the beta trial is off). */
  betaDays?: number;
  onOpenAccount: () => void;
  onClose: () => void;
}

export function PricingModal({
  cloudUser,
  currentPlanId = "free",
  beta = false,
  betaDays = 0,
  onOpenAccount,
  onClose,
}: PricingModalProps) {
  useBodyScrollLock(true);
  const dialogRef = useModalFocus(onClose);
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");

  async function handleCheckout(planId: PaidPlanId) {
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
            <p className="eyebrow">Monthly plans · cancel any time</p>
            <h2>Choose a plan</h2>
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
          {betaDays > 0 && (
            <p className="helper-text">
              Beta: every new account gets Go free for its first {betaDays}{" "}
              days, no card needed. After that it moves to Free unless you
              choose a plan.
            </p>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <PlanCards
            currentPlanId={currentPlanId}
            beta={beta}
            loadingPlan={loadingPlan}
            onChoose={(id) => void handleCheckout(id)}
          />
        </div>

        <div className="button-row">
          <p className="secure-badge">
            Payments are handled by Stripe when configured
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
