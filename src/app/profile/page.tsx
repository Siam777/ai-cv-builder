"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountPanel } from "@/components/account-panel";
import { accountRequest, transferLocalResumes } from "@/lib/cloud-repository";
import { createRepository } from "@/lib/repository";
import type { AccountUser } from "@/lib/cloud-contract";
import type { ResumeDocument } from "@/lib/document";

export default function ProfilePage() {
  const [cloudUser, setCloudUser] = useState<AccountUser | null>(null);
  const [localDocs, setLocalDocs] = useState<ResumeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const sessionRes = (await accountRequest("/api/account")) as {
          user?: AccountUser | null;
        };
        if (active && sessionRes?.user) {
          setCloudUser(sessionRes.user);
        }
      } catch {
        // Not signed in to cloud
      }

      try {
        const repo = createRepository();
        const docs = await repo.list();
        if (active) {
          setLocalDocs(docs);
        }
      } catch {
        // Local storage unavailable
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="profile-page-container">
      <header className="app-header no-print">
        <Link href="/" className="brand" aria-label="AI CV Builder home">
          <span className="brand-mark">
            cv<span>·</span>
          </span>
          <span>
            Profile & Account<small>AI CV BUILDER</small>
          </span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/" className="header-nav-link">
            Resume Studio
          </Link>
          <Link href="/upgrade" className="header-nav-link">
            Pricing
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

      <main className="profile-main-content">
        <div className="profile-hero">
          <span className="profile-badge">STORAGE & ACCOUNT WORKSPACE</span>
          <h1>Your Profile & Account Settings</h1>
          <p className="hero-lead">
            Manage your account credentials, cloud synchronization, and local storage workspace.
            Switch seamlessly between private browser-only storage and secure SQLite cloud sync.
          </p>
        </div>

        <div className="profile-dashboard-grid">
          <div className="profile-panel-column">
            <AccountPanel
              cloudOwner={cloudUser?.id ?? null}
              beforeChange={async () => {}}
              onLocal={async () => {
                setCloudUser(null);
              }}
              onCloud={async (user) => {
                setCloudUser(user);
              }}
              onSignedOut={async () => {
                setCloudUser(null);
              }}
              onClose={() => {
                window.location.href = "/";
              }}
              loadLocal={async () => {
                return createRepository().list();
              }}
              onTransfer={async (owner, docs) => {
                const result = await transferLocalResumes(owner, docs);
                return `${result.filter((r) => r.status === "imported").length} resumes copied to account. Local originals were kept.`;
              }}
              onExport={async (owner) => {
                const data = await accountRequest("/api/account/export", {}, owner);
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.style.display = "none";
                a.href = url;
                a.download = "cv-builder-account.json";
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                  if (a.parentNode) {
                    a.parentNode.removeChild(a);
                  }
                  URL.revokeObjectURL(url);
                }, 2000);
              }}
            />
          </div>

          <aside className="profile-sidebar-column">
            {/* Workspace Status Card */}
            <div className="profile-info-card workspace-summary-card">
              <div className="info-card-header">
                <span className="card-icon">💼</span>
                <h3>Workspace Overview</h3>
              </div>
              <div className="workspace-stat-row">
                <span className="stat-label">Active Storage:</span>
                <span className="stat-value">
                  {cloudUser ? "Cloud Account (SQLite)" : "Device Local (Browser)"}
                </span>
              </div>
              <div className="workspace-stat-row">
                <span className="stat-label">Local Resumes:</span>
                <span className="stat-value">
                  {loading ? "Checking…" : `${localDocs.length} saved on device`}
                </span>
              </div>
              {cloudUser && (
                <div className="workspace-stat-row">
                  <span className="stat-label">Cloud User:</span>
                  <span className="stat-value user-email-val">{cloudUser.email}</span>
                </div>
              )}
              <div className="card-action-row">
                <Link href="/" className="studio-cta-btn">
                  Open Resume Studio →
                </Link>
              </div>
            </div>

            {/* Subscription & Entitlements Card */}
            <div className="profile-info-card subscription-card">
              <div className="info-card-header">
                <span className="card-icon">⭐</span>
                <h3>Subscription & Plans</h3>
              </div>
              <p>
                Unlock unlimited 1-Click Job Tailoring, watermark-free PDF/DOCX exports, and all 8 designer templates.
              </p>
              <div className="plan-badge-row">
                <span className="current-plan-tag">Current: Free / Local</span>
              </div>
              <Link href="/upgrade" className="upgrade-cta-btn">
                View Upgrade Options ↗
              </Link>
            </div>

            {/* Privacy & Sovereignty Card */}
            <div className="profile-info-card privacy-card">
              <div className="info-card-header">
                <span className="card-icon">🔒</span>
                <h3>Privacy & Data Control</h3>
              </div>
              <p>
                We believe in zero-surveillance design. Local resumes never leave your browser without explicit cloud sync.
              </p>
              <ul className="privacy-feature-list">
                <li>✓ Full JSON export backup anytime</li>
                <li>✓ 1-Click permanent account deletion</li>
                <li>✓ No third-party data tracking</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <footer className="profile-footer no-print">
        <p>AI CV Builder · Privacy-First Career Tooling · Deterministic Resume Architecture</p>
      </footer>
    </div>
  );
}
