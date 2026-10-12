"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { accountRequest } from "@/lib/cloud-repository";
import type { AccountUser } from "@/lib/cloud-contract";
import { PLANS, type PlanId } from "@/lib/billing-plans";

export default function UpgradePage() {
  const [cloudUser, setCloudUser] = useState<AccountUser | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

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
    return () => {
      active = false;
    };
  }, []);

  async function handleCheckout(planId: PlanId) {
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
      q: "Can I manage a subscription?",
      a: "Billing settings require configured payment services. Checkout, cancellation and renewal flows still need live validation on the deployed application.",
    },
    {
      q: "Can I keep editing without a paid plan?",
      a: "Device editing, the current designs and local writing tools are available without payment. Every app download requires sign-in; CVs, letters and recovery backups also require verified email.",
    },
    {
      q: "How does job tailoring work?",
      a: "The local tool compares keyword and token overlap and reorders existing content into an independent variant. It does not verify qualifications or invent career facts. AI bullet suggestions use a separate consent and review flow.",
    },
    {
      q: "What do the paid limits mean?",
      a: "The cards show the current configuration, not an unlimited-use or permanent-storage promise. Some limits and paid features still need integration and live validation. Review the final product terms before subscribing.",
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
            Plans & Pricing<small>AI CV BUILDER</small>
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
            PROPOSED PLANS & CONFIGURED LIMITS
          </span>
          <h1>Invest In Your Next Career Chapter</h1>
          <p className="hero-lead">
            Explore the current plan configuration. Payment, cancellation and
            paid-provider services still need live validation before a public
            release.
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
            <span>⚠️ {error}</span>
            {!cloudUser && (
              <Link href="/profile" className="alert-action-link">
                Go to Profile to Sign In →
              </Link>
            )}
          </div>
        )}

        <p className="box-hint">
          Proposed paid plan details. Prices and caps reflect the current
          configuration; enforcement and paid features are not all integrated or
          live-validated. Device editing currently includes twelve designs and
          multiple drafts. All CV downloads require sign-in and verified email.
        </p>
        {/* Pricing Cards Grid */}
        <section className="pricing-cards-section">
          <div className="pricing-grid">
            {/* Free Forever */}
            <div className="pricing-card">
              <div className="card-top">
                <span className="plan-badge">DEVICE EDITING</span>
                <h3>Free / Local</h3>
                <div className="plan-price">
                  <span className="price-val">$0</span>
                </div>
                <p className="plan-sub">
                  Perfect for drafting a baseline resume locally on your
                  machine.
                </p>
              </div>
              <ul className="plan-features">
                <li>✓ Multiple independent device drafts</li>
                <li>✓ Browser editing and device autosave</li>
                <li>✓ Standard PDF print export (subtle watermark)</li>
                <li>✓ Plain-text & JSON backup export</li>
                <li>✓ Explicit device or account storage</li>
                <li className="dimmed">✓ Local rule-based job tailoring</li>
                <li className="dimmed">✗ Watermark-free PDF & DOCX exports</li>
                <li className="dimmed">
                  ✓ Local career vault and writing tools
                </li>
              </ul>
              <Link href="/builder" className="plan-button outline">
                Continue Free in Studio
              </Link>
            </div>

            {/* Job Hunter Monthly Pass */}
            <div className="pricing-card featured">
              <div className="popular-ribbon">MONTHLY PLAN</div>
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
                  ✓ <strong>Clean, watermark-free</strong> PDF & DOCX export
                </li>
                <li>
                  ✓ <strong>All 8 designer templates</strong> (Classic, Modern,
                  Tech, Executive, etc.)
                </li>
                <li>
                  ✓{" "}
                  <strong>Master Career Vault & Google XYZ Impact Coach</strong>
                </li>
                <li>✓ Writing findings and term observations</li>
                <li>✓ Cover Letter Studio with 1-click matching</li>
                <li>Cancellation flow requires live validation</li>
              </ul>
              <button
                type="button"
                className="plan-button primary"
                disabled={loadingPlan !== null}
                onClick={() => handleCheckout("job_hunter_monthly")}
              >
                {loadingPlan === "job_hunter_monthly"
                  ? "Redirecting to Stripe…"
                  : "Upgrade to Job Hunter Pass ↗"}
              </button>
            </div>

            {/* Lifetime Access */}
            <div className="pricing-card">
              <div className="card-top">
                <span className="plan-badge">ONE-TIME PLAN</span>
                <h3>Power Pass</h3>
                <div className="plan-price">
                  <span className="price-val">$79</span>
                  <span className="price-period">one-time</span>
                </div>
                <p className="plan-sub">
                  For senior professionals and managers maintaining lifelong
                  career assets.
                </p>
              </div>
              <ul className="plan-features">
                <li>One-time plan configuration</li>
                <li>
                  Configured cap:{" "}
                  <strong>{PLANS.lifetime.maxTailoredPerMonth}</strong>{" "}
                  tailoring uses/month
                </li>
                <li>All twelve editor designs</li>
                <li>
                  ✓{" "}
                  <strong>
                    Watermark-free PDF/DOCX while entitlement is active
                  </strong>
                </li>
                <li>
                  ✓ Multi-format exports (PDF, DOCX, Markdown, HTML, JSON)
                </li>
                <li>Provider features await live validation</li>
                <li>Future features are separately planned</li>
              </ul>
              <button
                type="button"
                className="plan-button primary dark"
                disabled={loadingPlan !== null}
                onClick={() => handleCheckout("lifetime")}
              >
                {loadingPlan === "lifetime"
                  ? "Redirecting to Stripe…"
                  : "Review Power Pass ↗"}
              </button>
            </div>
          </div>
        </section>

        {/* Feature Comparison Matrix */}
        <section className="upgrade-matrix-section">
          <h2>Detailed Feature Comparison</h2>
          <div className="table-responsive">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Features</th>
                  <th>Free / Local</th>
                  <th className="highlight-col">Job Hunter Pass</th>
                  <th>One-time Power Pass</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Configured account variant cap</td>
                  <td>1</td>
                  <td className="highlight-col">
                    <strong>
                      {PLANS.job_hunter_monthly.maxVariants} configured
                    </strong>
                  </td>
                  <td>
                    <strong>{PLANS.lifetime.maxVariants} configured</strong>
                  </td>
                </tr>
                <tr>
                  <td>1-Click Job Description Tailoring</td>
                  <td>Available locally; export requires verified email</td>
                  <td className="highlight-col">
                    <strong>
                      {PLANS.job_hunter_monthly.maxTailoredPerMonth} / month
                      configured
                    </strong>
                  </td>
                  <td>
                    <strong>
                      {PLANS.lifetime.maxTailoredPerMonth} / month configured
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td>Clean, Watermark-Free PDF Exports</td>
                  <td>—</td>
                  <td className="highlight-col">✓ Included</td>
                  <td>✓ Included</td>
                </tr>
                <tr>
                  <td>DOCX, Markdown & HTML Exporters</td>
                  <td>
                    Available with verified email; PDF/DOCX use a watermark
                  </td>
                  <td className="highlight-col">✓ Included</td>
                  <td>✓ Included</td>
                </tr>
                <tr>
                  <td>All 8 Designer Templates</td>
                  <td>All 8 current designs</td>
                  <td className="highlight-col">✓ All 8 Templates</td>
                  <td>All 8 current designs</td>
                </tr>
                <tr>
                  <td>Google XYZ Impact Bullet Coach</td>
                  <td>Available locally; review every factual claim</td>
                  <td className="highlight-col">✓ Included</td>
                  <td>✓ Included</td>
                </tr>
                <tr>
                  <td>Master Career Vault</td>
                  <td>Browser Local</td>
                  <td className="highlight-col">
                    Local vault; account CV storage is separate
                  </td>
                  <td>Local vault; account CV storage is separate</td>
                </tr>
                <tr>
                  <td>Document content review</td>
                  <td>Findings and term observations</td>
                  <td className="highlight-col">
                    Findings and term observations
                  </td>
                  <td>Findings and term observations</td>
                </tr>
              </tbody>
            </table>
          </div>
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
