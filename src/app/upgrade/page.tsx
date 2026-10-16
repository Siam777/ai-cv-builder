"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { accountRequest } from "@/lib/cloud-repository";
import type { AccountUser } from "@/lib/cloud-contract";
import {
  normalizePlanId,
  type PaidPlanId,
  type PlanId,
} from "@/lib/billing-plans";
import { PlanCards, PlanComparison } from "@/components/billing/PlanCards";
import { TriangleAlert } from "lucide-react";

export default function UpgradePage() {
  const [cloudUser, setCloudUser] = useState<AccountUser | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [plan, setPlan] = useState<{ planId: PlanId; beta: boolean; betaDays: number }>({
    planId: "free",
    beta: false,
    betaDays: 0,
  });

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const res = (await accountRequest("/api/account")) as {
          user?: AccountUser | null;
        };
        if (active && res?.user) {
          setCloudUser(res.user);
        }
      } catch {
        // Not signed in
      }
    }
    void checkSession();
    void fetch("/api/billing/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data)
          setPlan({
            planId: normalizePlanId(data.subscription?.planId),
            beta: Boolean(data.subscription?.beta),
            betaDays: Number(data.betaTrialDays ?? 0),
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function handleCheckout(planId: PaidPlanId) {
    if (!cloudUser) {
      setError(
        "Please sign in or create an account on your Profile page to activate a subscription.",
      );
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

  const faqs = [
    {
      q: "What do I get during the beta?",
      a: `Every new account gets Go free for its first ${plan.betaDays || 30} days, with no card. After that it moves to Free unless you choose Go or Pro.`,
    },
    {
      q: "Can I keep using the editor for free?",
      a: "Yes. Free includes the full editor, all 12 designs, Check my CV, built-in writing helpers and 5 AI rewrites a day. Downloads need an account; Free PDFs carry a small watermark.",
    },
    {
      q: "What counts as an AI rewrite?",
      a: "Each AI request, such as improving a bullet or drafting a summary. Nothing is changed until you accept it, and AI only uses what your CV already says.",
    },
    {
      q: "How do I cancel?",
      a: "Plans are monthly and can be cancelled at any time from Account settings, Billing. Payments are handled by Stripe once it is set up on this installation.",
    },
  ];


  return (
    <div className="upgrade-page-container">
      <header className="app-header no-print">
        <Link href="/" className="brand" aria-label="AI CV Builder home">
          <span className="brand-mark">
            cv<span>·</span>
          </span>
          <span>
            Plans & Pricing<small>AI CV Builder</small>
          </span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/builder" className="header-nav-link">
            Resume Studio
          </Link>
          <Link href="/profile" className="header-nav-link">
            Profile & Account
          </Link>
          <Link href="/grader" className="header-nav-link">
            Resume review
          </Link>
        </nav>
        <div className="header-right">
          <Link href="/builder" className="back-to-studio-btn">
            ← Back to Resume Studio
          </Link>
        </div>
      </header>

      <main className="upgrade-main-content">
        {/* Hero Section */}
        <section className="upgrade-hero">
          <span className="upgrade-badge">
            {plan.betaDays > 0
              ? `Beta: Go free for ${plan.betaDays} days after sign-up`
              : "Monthly plans"}
          </span>
          <h1>Plans for every stage of your job search</h1>
          <p className="hero-lead">
            Start free. Choose Go for an active search or Pro for many
            applications. All plans are monthly and you can cancel any time.
          </p>

          <div className="hero-trust-row">
            <span className="trust-item">
              Checkout requires configured payment services
            </span>
            <span className="trust-item">
              CV exports require sign-in and verified email
            </span>
            <span className="trust-item">Review terms before subscribing</span>
          </div>
        </section>

        {error && (
          <div className="upgrade-alert" role="alert">
            <span>
              <TriangleAlert size={16} aria-hidden /> {error}
            </span>
            {!cloudUser && (
              <Link href="/profile" className="alert-action-link">
                Go to Profile to Sign In →
              </Link>
            )}
          </div>
        )}

        {plan.beta && (
          <p className="box-hint">
            You are on Go for free during the beta. Choose a plan to keep its
            features afterwards.
          </p>
        )}
        {/* Pricing Cards Grid */}
        <section className="pricing-cards-section">
          <PlanCards
            currentPlanId={plan.planId}
            beta={plan.beta}
            loadingPlan={loadingPlan}
            onChoose={(id) => void handleCheckout(id)}
          />
        </section>

        <section className="upgrade-matrix-section">
          <h2>Compare plans</h2>
          <PlanComparison />
        </section>

        {/* FAQ Section */}
        <section className="upgrade-faq-section">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-grid">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className={`faq-card ${activeFaq === idx ? "active" : ""}`}
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
              >
                <div className="faq-question">
                  <h4>{faq.q}</h4>
                  <span className="faq-toggle">
                    {activeFaq === idx ? "−" : "+"}
                  </span>
                </div>
                <p className="faq-answer">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Banner */}
        <section className="upgrade-bottom-cta">
          <div className="bottom-cta-content">
            <h3>Start editing your resume</h3>
            <p>
              Ready to edit? You can jump right into the studio or choose your
              plan above.
            </p>
            <div className="cta-button-group">
              <Link href="/builder" className="primary-cta-btn">
                Open Resume Studio →
              </Link>
              <Link href="/profile" className="secondary-cta-btn">
                Manage Profile & Account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="upgrade-footer no-print">
        <p>
          AI CV Builder · Payment services require configuration and live
          validation.
        </p>
      </footer>
    </div>
  );
}
