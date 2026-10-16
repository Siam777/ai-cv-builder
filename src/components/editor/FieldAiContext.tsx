"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ResumeDocument } from "@/lib/document";
import type { Proposal } from "@/lib/ai-proposals";
import type { FieldActionId, FieldKind } from "@/lib/field-ai";
import { accountRequest } from "@/lib/cloud-repository";

/** A sparkle action the AI Assistant asked a field to start. */
export interface PendingFieldAction {
  /** Changes on every request so the same action can be asked twice. */
  id: number;
  kind: FieldKind;
  action: FieldActionId;
  bulletId?: string;
}

export interface RewriteAvailability {
  configured: boolean;
  signedIn: boolean;
  /** The account turned on AI writing help (one-time consent). */
  aiConsent?: boolean;
}

/** What every sparkle menu needs from the studio. */
export interface FieldAiServices {
  doc: ResumeDocument;
  /** Signed-in account that owns the open CV; null for CVs on this device. */
  owner: string | null;
  availability: RewriteAvailability | "unreachable" | null;
  /** Signed in, even when the open CV is the copy saved in this browser. */
  signedIn: boolean;
  /** Copies the open browser CV to the signed-in account and opens it there. */
  onCopyToAccount: () => void;
  /** The plan includes AI summary drafts (Go and Pro). */
  summaryDrafts: boolean;
  /** AI writing help is on for the account (asked once, kept on the account). */
  aiConsent: boolean;
  /** Turns AI writing help on for the account. */
  grantConsent: () => Promise<void>;
  /** The job title examples are suggested for (headline or latest job). */
  starterTitle: string;
  /** The plan includes Suggest skills with AI (Go and Pro). */
  skillsAi: boolean;
  /** The plan includes Improve all bullets (Go and Pro). */
  improveAll: boolean;
  /** The plan includes Match with AI (Go and Pro) and Tailor with AI (Pro). */
  jobMatch: boolean;
  tailor: boolean;
  /** Saves a reviewed tailored copy of the CV it was made from. */
  saveTailoredCopy: (tailored: ResumeDocument, sourceSnapshot: string) => Promise<boolean>;
  /** Applies one change to the open CV (one Undo step). */
  updateDocument: (mutator: (draft: ResumeDocument) => void) => void;
  onSeePlans: () => void;
  prepare: () => Promise<ResumeDocument>;
  /** Accepts a proposal; bulletIds limits a multi-bullet proposal to the ticked ones. */
  accept: (proposal: Proposal, bulletIds?: string[]) => Promise<void>;
  onOpenAccount: () => void;
  pending: PendingFieldAction | null;
  consumePending: (id: number) => void;
}

const FieldAiContext = createContext<FieldAiServices | null>(null);
export const FieldAiProvider = FieldAiContext.Provider;

/** Null outside the studio, where fields simply have no sparkle menu. */
export function useFieldAi() {
  return useContext(FieldAiContext);
}

/** Whether the AI provider is configured and the session is live. */
export function useRewriteAvailability(owner: string | null) {
  const [availability, setAvailability] = useState<
    RewriteAvailability | "unreachable" | null
  >(null);
  useEffect(() => {
    if (!owner) {
      setAvailability(null);
      return;
    }
    let active = true;
    void accountRequest("/api/ai")
      .then((value) => {
        if (active) setAvailability(value as RewriteAvailability);
      })
      .catch(() => {
        if (active) setAvailability("unreachable");
      });
    return () => {
      active = false;
    };
  }, [owner]);
  return availability;
}
