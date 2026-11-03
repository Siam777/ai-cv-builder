"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ACCOUNT_TABS,
  AccountPanel,
  type AccountTab,
} from "@/components/account-panel";
import { accountRequest, transferLocalResumes } from "@/lib/cloud-repository";
import { createRepository } from "@/lib/repository";
import type { AccountUser } from "@/lib/cloud-contract";
import { ArrowLeft } from "lucide-react";

/** After sign-in, return to the tracker when it sent the person here. */
function returnTarget() {
  if (typeof window === "undefined") return null;
  const target = new URLSearchParams(window.location.search).get("return");
  return target && /^\/applications(\?[A-Za-z0-9=&%_.-]*)?$/.test(target)
    ? target
    : null;
}

function requestedTab(): AccountTab {
  if (typeof window === "undefined") return "profile";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return ACCOUNT_TABS.some(([id]) => id === tab) ? (tab as AccountTab) : "profile";
}

export default function ProfilePage() {
  const [cloudUser, setCloudUser] = useState<AccountUser | null>(null);
  const [initialTab, setInitialTab] = useState<AccountTab | null>(null);

  useEffect(() => {
    let active = true;
    setInitialTab(requestedTab());
    void accountRequest("/api/account")
      .then((value) => {
        const user = (value as { user?: AccountUser | null }).user;
        if (active && user) setCloudUser(user);
      })
      .catch(() => {
        // Not signed in; the panel shows the sign-in form.
      });
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
            Account settings<small>AI CV Builder</small>
          </span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/builder" className="header-nav-link">
            My CVs
          </Link>
          <Link href="/applications" className="header-nav-link">
            Applications
          </Link>
          <Link href="/pricing" className="header-nav-link">
            Pricing
          </Link>
          <Link href="/help" className="header-nav-link">
            Help
          </Link>
        </nav>
        <div className="header-right">
          <Link href="/builder" className="back-to-studio-btn">
            <ArrowLeft size={16} aria-hidden /> Back to My CVs
          </Link>
        </div>
      </header>

      <main className="profile-main-content">
        {initialTab && (
          <AccountPanel
            initialTab={initialTab}
            headingLevel={1}
            cloudOwner={cloudUser?.id ?? null}
            beforeChange={async () => {}}
            onCloud={async () => {
              window.location.assign("/builder");
            }}
            onAuthenticated={async (user) => {
              setCloudUser(user);
              const target = returnTarget();
              if (target) window.location.assign(target);
            }}
            onSignedOut={async () => {
              setCloudUser(null);
            }}
            loadLocal={async () => createRepository().list()}
            onTransfer={async (owner, docs) => {
              const result = await transferLocalResumes(owner, docs);
              return `${result.filter((r) => r.status === "imported").length} CVs copied to your account. The copies in this browser were kept.`;
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
                a.remove();
                URL.revokeObjectURL(url);
              }, 2000);
            }}
          />
        )}
      </main>

      <footer className="profile-footer no-print">
        <p>AI CV Builder · Developed by Elfasys Solution</p>
      </footer>
    </div>
  );
}
