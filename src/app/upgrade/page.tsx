"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { accountRequest } from "@/lib/cloud-repository";
import type { AccountUser } from "@/lib/cloud-contract";
import type { PlanId } from "@/lib/billing-plans";

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
      setError("Please sign in or create an account on your Profile page to activate a subscription.");
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

  const faqs = [
    {
      q: "Can I cancel my subscription anytime?",
      a: "Yes, absolutely. You can cancel your Job Hunter Pass with 1 click from your billing portal at any time. You will retain full access until the end of your billing cycle.",
    },
    {
      q: "What happens to my resumes if I cancel?",
      a: "Your resumes and data remain completely yours. You can always edit, export plain text, or download full JSON backups on the Free tier even after cancelling.",
    },
    {
      q: "How does 1-Click Job Tailoring work?",
      a: "Our evidence-grounded AI analyzes the target job description against your Master Career Vault. It re-ranks and customizes bullet points using Google's XYZ impact formula (Accomplished [X] as measured by [Y], by doing [Z]) while strictly preventing hallucinations.",
    },
    {
      q: "Are exports truly watermark-free?",
      a: "Yes. Both Job Hunter Pass and Lifetime Pass members get 100% clean, professional exports across all formats (PDF, DOCX, Markdown, HTML) with no promotional footers or watermarks.",
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
          <Link href="/" className="header-nav-link">
            Resume Studio
          </Link>
          <Link href="/profile" className="header-nav-link">
            Profile & Account
          </Link>
          <Link href="/grader" className="header-nav-link">
            ATS Grader
          </Link>
        </nav>
        <div className="header-right">
          <Link href="/" className="back-to-studio-btn">
            ← Back to Resume Studio
          </Link>
        </div>
      </header>

      <main className="upgrade-main-content">
        {/* Hero Section */}
        <section className="upgrade-hero">
          <span className="upgrade-badge">FAIR, TRANSPARENT SAAS PRICING</span>
          <h1>Invest In Your Next Career Chapter</h1>
          <p className="hero-lead">
            Land interviews faster with evidence-grounded AI tailoring, all 8 designer templates,
            and deterministic ATS optimization. No hidden fees or lock-ins.
          </p>

          <div className="hero-trust-row">
            <span className="trust-item">🔒 256-bit encrypted checkout via Stripe</span>
            <span className="trust-item">✓ 14-day money-back guarantee</span>
            <span className="trust-item">✓ 1-click instant cancellation</span>
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

        {/* Pricing Cards Grid */}
        <section className="pricing-cards-section">
          <div className="pricing-grid">
            {/* Free Forever */}
            <div className="pricing-card">
              <div className="card-top">
                <span className="plan-badge">FREE FOREVER</span>
                <h3>Free / Local</h3>
                <div className="plan-price">
                  <span className="price-val">$0</span>
                </div>
                <p className="plan-sub">Perfect for drafting a baseline resume locally on your machine.</p>
              </div>
              <ul className="plan-features">
                <li>✓ 1 active resume variant</li>
                <li>✓ Unlimited offline browser editing & autosave</li>
                <li>✓ Standard PDF print export (subtle watermark)</li>
                <li>✓ Plain-text & JSON backup export</li>
                <li>✓ Local-first zero-surveillance storage</li>
                <li className="dimmed">✗ 1-Click Job Description Tailoring</li>
                <li className="dimmed">✗ Watermark-free PDF & DOCX exports</li>
                <li className="dimmed">✗ Master Career Vault & Impact Coach</li>
              </ul>
              <Link href="/" className="plan-button outline">
                Continue Free in Studio
              </Link>
            </div>

            {/* Job Hunter Monthly Pass */}
            <div className="pricing-card featured">
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
                <li>✓ <strong>All 8 designer templates</strong> (Classic, Modern, Tech, Executive, etc.)</li>
                <li>✓ <strong>Master Career Vault & Google XYZ Impact Coach</strong></li>
                <li>✓ Deterministic ATS score inspector & keyword gap matching</li>
                <li>✓ Cover Letter Studio with 1-click matching</li>
                <li>✓ Cancel anytime in 1 click</li>
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
                <span className="plan-badge">LIFETIME ACCESS</span>
                <h3>Power Pass</h3>
                <div className="plan-price">
                  <span className="price-val">$79</span>
                  <span className="price-period">one-time</span>
                </div>
                <p className="plan-sub">For senior professionals and managers maintaining lifelong career assets.</p>
              </div>
              <ul className="plan-features">
                <li>✓ <strong>Permanent</strong> Master Career Vault storage</li>
                <li>✓ <strong>Unlimited</strong> 1-Click Job Tailoring for life</li>
                <li>✓ <strong>All present & future template families</strong></li>
                <li>✓ <strong>Lifetime clean watermark-free exports</strong></li>
                <li>✓ Multi-format exports (PDF, DOCX, Markdown, HTML, JSON)</li>
                <li>✓ Priority AI response queue & VIP support</li>
                <li>✓ Lifetime access to all updates and new tools</li>
              </ul>
              <button
                type="button"
                className="plan-button primary dark"
                disabled={loadingPlan !== null}
                onClick={() => handleCheckout("lifetime")}
              >
                {loadingPlan === "lifetime"
                  ? "Redirecting to Stripe…"
                  : "Get Lifetime Pass ↗"}
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
                  <th>Lifetime Power Pass</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Active Resume Variants</td>
                  <td>1</td>
                  <td className="highlight-col"><strong>Unlimited</strong></td>
                  <td><strong>Unlimited</strong></td>
                </tr>
                <tr>
                  <td>1-Click Job Description Tailoring</td>
                  <td>—</td>
                  <td className="highlight-col"><strong>50 / month</strong></td>
                  <td><strong>Unlimited</strong></td>
                </tr>
                <tr>
                  <td>Clean, Watermark-Free PDF Exports</td>
                  <td>—</td>
                  <td className="highlight-col">✓ Included</td>
                  <td>✓ Included</td>
                </tr>
                <tr>
                  <td>DOCX, Markdown & HTML Exporters</td>
                  <td>—</td>
                  <td className="highlight-col">✓ Included</td>
                  <td>✓ Included</td>
                </tr>
                <tr>
                  <td>All 8 Designer Templates</td>
                  <td>Basic 2</td>
                  <td className="highlight-col">✓ All 8 Templates</td>
                  <td>✓ All Present & Future</td>
                </tr>
                <tr>
                  <td>Google XYZ Impact Bullet Coach</td>
                  <td>—</td>
                  <td className="highlight-col">✓ Included</td>
                  <td>✓ Included</td>
                </tr>
                <tr>
                  <td>Master Career Vault Sync</td>
                  <td>Browser Local</td>
                  <td className="highlight-col">Cloud SQLite Sync</td>
                  <td>Permanent Cloud Sync</td>
                </tr>
                <tr>
                  <td>Deterministic ATS Scanner</td>
                  <td>Basic Check</td>
                  <td className="highlight-col">Full Inspector & Gaps</td>
                  <td>Full Inspector & Gaps</td>
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
                  <span className="faq-toggle">{activeFaq === idx ? "−" : "+"}</span>
                </div>
                <p className="faq-answer">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Banner */}
        <section className="upgrade-bottom-cta">
          <div className="bottom-cta-content">
            <h3>Start crafting your interview-winning resume today</h3>
            <p>Ready to edit? You can jump right into the studio or choose your plan above.</p>
            <div className="cta-button-group">
              <Link href="/" className="primary-cta-btn">
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
        <p>AI CV Builder · 256-bit encrypted checkout via Stripe · All rights reserved.</p>
      </footer>
    </div>
  );
}
