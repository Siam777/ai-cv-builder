"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AccountPanel } from "@/components/account-panel";
import { accountRequest, transferLocalResumes } from "@/lib/cloud-repository";
import { createRepository } from "@/lib/repository";
import type { AccountUser } from "@/lib/cloud-contract";
import type { ResumeDocument } from "@/lib/document";
import { Briefcase, Check, Lock, Star } from "lucide-react";

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
            Profile & Account<small>AI CV Builder</small>
          </span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/builder" className="header-nav-link">
            Resume Studio
          </Link>
          <Link href="/upgrade" className="header-nav-link">
            Pricing
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

      <main className="profile-main-content">
        <div className="profile-hero">
          <span className="profile-badge">Storage & account workspace</span>
          <h1>Your Profile & Account Settings</h1>
          <p className="hero-lead">
            Manage your account credentials, cloud synchronization, and local
            storage workspace. Choose device storage or account storage. Signing
            in does not upload device drafts automatically.
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
                window.location.href = "/builder";
              }}
              loadLocal={async () => {
                return createRepository().list();
              }}
              onTransfer={async (owner, docs) => {
                const result = await transferLocalResumes(owner, docs);
                return `${result.filter((r) => r.status === "imported").length} resumes copied to account. Local originals were kept.`;
              }}
              onExport={async (owner) => {
                const data = await accountRequest(
                  "/api/account/export",
                  {},
                  owner,
                );
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
                <Briefcase className="card-icon" size={20} aria-hidden />
                <h3>Workspace Overview</h3>
              </div>
              <div className="workspace-stat-row">
                <span className="stat-label">Active Storage:</span>
                <span className="stat-value">
                  {cloudUser ? "Account storage" : "Device Local (Browser)"}
                </span>
              </div>
              <div className="workspace-stat-row">
                <span className="stat-label">Local Resumes:</span>
                <span className="stat-value">
                  {loading
                    ? "Checking…"
                    : `${localDocs.length} saved on device`}
                </span>
              </div>
              {cloudUser && (
                <div className="workspace-stat-row">
                  <span className="stat-label">Cloud User:</span>
                  <span className="stat-value user-email-val">
                    {cloudUser.email}
                  </span>
                </div>
              )}
              <div className="card-action-row">
                <Link href="/builder" className="studio-cta-btn">
                  Open Resume Studio →
                </Link>
              </div>
            </div>

            {/* Subscription & Entitlements Card */}
            <div className="profile-info-card subscription-card">
              <div className="info-card-header">
                <Star className="card-icon" size={20} aria-hidden />
                <h3>Subscription & Plans</h3>
              </div>
              <p>
                Review proposed paid plans and configured limits. Payment and
                subscription services still require live validation.
              </p>
              <div className="plan-badge-row">
                <span className="current-plan-tag">
                  Plan status: check billing settings
                </span>
              </div>
              <Link href="/upgrade" className="upgrade-cta-btn">
                View Upgrade Options ↗
              </Link>
            </div>

            {/* Privacy & Sovereignty Card */}
            <div className="profile-info-card privacy-card">
              <div className="info-card-header">
                <Lock className="card-icon" size={20} aria-hidden />
                <h3>Privacy & Data Control</h3>
              </div>
              <p>
                Device drafts stay in this browser until you choose an account
                import or consent to server processing for an export. File
                uploads are processed on the application server.
              </p>
              <ul className="privacy-feature-list">
                <li><Check size={16} aria-hidden /> JSON backups require sign-in and verified email</li>
                <li><Check size={16} aria-hidden /> Account deletion requires explicit confirmation</li>
                <li><Check size={16} aria-hidden /> AI provider requests require explicit consent</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <footer className="profile-footer no-print">
        <p>
          AI CV Builder · Privacy-First Career Tooling · Deterministic Resume
          Architecture
        </p>
      </footer>
    </div>
  );
}
