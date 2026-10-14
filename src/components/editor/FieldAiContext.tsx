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
}

/** What every sparkle menu needs from the studio. */
export interface FieldAiServices {
  doc: ResumeDocument;
  /** Signed-in account that owns the open CV; null for CVs on this device. */
  owner: string | null;
  availability: RewriteAvailability | "unreachable" | null;
  prepare: () => Promise<ResumeDocument>;
  accept: (proposal: Proposal) => Promise<void>;
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
