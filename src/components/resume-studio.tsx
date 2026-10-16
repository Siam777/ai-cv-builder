"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDocument,
  duplicateDocument,
  parseBackup,
  documentSchema,
  uid,
  newEntry,
  labels,
  type ResumeDocument,
} from "@/lib/document";
import { createRepository } from "@/lib/repository";
import { ResumePreview, type PreviewHandle } from "./resume-preview";
import { DesignPanel, type TemplateFilter } from "./design-panel";
import { templates } from "@/lib/presentation";
import { AccountPanel } from "./account-panel";
import { AIPanel } from "./ai-panel";
import {
  FieldAiProvider,
  useRewriteAvailability,
  type FieldAiServices,
  type PendingFieldAction,
} from "./editor/FieldAiContext";
import type { HelpItem } from "@/lib/help-me-finish";
import { planAllows } from "@/lib/ai-access";
import { aiFixFor } from "@/lib/field-ai";
import type { Proposal } from "@/lib/ai-proposals";
import type { LayoutBlock } from "@/lib/layout";
import {
  accountRequest,
  createCloudRepository,
  transferLocalResumes,
  importReceipts,
  CloudRequestError,
} from "@/lib/cloud-repository";
import { userCanExport, type AccountUser } from "@/lib/cloud-contract";
import { EditorHeader } from "./editor/EditorHeader";
import {
  EditorToolbar,
  type ExportFormat,
  type SidePanelId,
} from "./editor/EditorToolbar";
import { SidePanel, useSheetLayout } from "./editor/SidePanel";
import { cvStrength } from "@/lib/cv-strength";
import { lintResumeDocument } from "@/lib/linter/ats-linter";
import { rememberWorkspaceFocus } from "@/lib/use-modal-focus";
import { EditorSidebar } from "./editor/EditorSidebar";
import { SectionEditor } from "./editor/SectionEditor";
import { StartScreen } from "./editor/StartScreen";
import { AiInterview } from "./editor/AiInterview";
import { BrowserCvsBanner } from "./editor/BrowserCvsBanner";
import {
  ImportReviewModal,
  type StagedImportData,
} from "./editor/ImportReviewModal";
import { parseTextToResume } from "@/lib/importers/text-resume-parser";
import {
  parseLinkedInArchive,
  isLinkedInCsv,
} from "@/lib/importers/linkedin-importer";
import { JobTailorModal } from "./vault/JobTailorModal";
import { reviewSnapshot } from "@/lib/vault/job-evidence";
import { CoverLetterModal } from "./vault/CoverLetterModal";
import { VersionHistoryModal } from "./editor/VersionHistoryModal";
import { AddSectionModal } from "./editor/AddSectionModal";
import { CheckPanel } from "./editor/CheckPanel";
import { loadDismissed, saveDismissed } from "@/lib/dismissed-findings";
import { issuesToFix } from "@/lib/check-findings";
import type { AtsLintIssue } from "@/lib/linter/ats-linter";
import { KeyboardShortcutsModal } from "./editor/KeyboardShortcutsModal";
import { PricingModal } from "./billing/PricingModal";
import { LockedFeature } from "./billing/LockedFeature";
import { AiCvGeneratorModal } from "./editor/AiCvGeneratorModal";
import { DemoResumesModal } from "./editor/DemoResumesModal";
import { DocumentLibrary } from "./editor/DocumentLibrary";
import { documentsInCollection, startFromDesign } from "@/lib/document-library";
import {
  requestExport,
  downloadArtifact,
  printArtifact,
} from "@/lib/export-client";
import type { ExportRequest, ExportSource } from "@/lib/export-contract";
import { normalizePlanId, type PlanId } from "@/lib/billing-plans";
import type { StartingDesign } from "@/lib/public-catalog";
import type { FocusTarget, SaveState } from "./editor/types";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import {
  notifySessionChange,
  watchSessionChanges,
} from "@/lib/session-events";
import { GuidedStartModal } from "./editor/GuidedStartModal";
import { PanelDialog } from "./editor/PanelDialog";

function download(
  content: string | Uint8Array | BlobPart,
  name: string,
  type: string,
) {
  const blob =
    content instanceof Blob ? content : new Blob([content as any], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 2000);
}

/** The job title examples are suggested for: the headline, else the latest job. */
function starterTitle(doc: ResumeDocument) {
  const job = doc.sections
    .find((section) => section.type === "experience")
    ?.entries.find((entry) => entry.title.trim());
  return (doc.contact.headline.trim() || job?.title.trim() || "").slice(0, 120);
}

export function ResumeStudio({
  startingDesign = null,
}: {
  startingDesign?: StartingDesign | null;
}) {
  const [selectedStart, setSelectedStart] = useState(startingDesign);
  const [showLibrary, setShowLibrary] = useState(true);
  const [sessionUser, setSessionUser] = useState<AccountUser | null>(null);
  type PendingExport = {
    doc: ResumeDocument;
    owner: string | null;
    format: ExportFormat | "print" | "copy";
    letter?: { text: string; name: string };
    recovery?: boolean;
  };
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(
    null,
  );
  const [doc, setDoc] = useState<ResumeDocument | null>(null);
  const [documents, setDocuments] = useState<ResumeDocument[]>([]);
  const [sectionId, setSectionId] = useState("contact");
  const [status, setStatus] = useState<SaveState>("Loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Design, Check and AI share one side panel that replaces the preview.
  const [activePanel, setActivePanel] = useState<SidePanelId | null>(null);
  const showDesign = activePanel === "design";
  const showAts = activePanel === "check";
  const showAI = activePanel === "ai";
  const panelSetter =
    (id: SidePanelId) =>
    (value: boolean | ((previous: boolean) => boolean)) =>
      setActivePanel((previous) => {
        const open =
          typeof value === "function" ? value(previous === id) : value;
        return open ? id : previous === id ? null : previous;
      });
  const setShowDesign = panelSetter("design");
  const setShowAts = panelSetter("check");
  const setShowAI = panelSetter("ai");
  const sheetLayout = useSheetLayout();
  const [designFilter, setDesignFilter] = useState<TemplateFilter>("all");
  const [showAccount, setShowAccount] = useState(false);
  // A sparkle action the AI Assistant asked a field to start.
  const [pendingField, setPendingField] = useState<PendingFieldAction | null>(
    null,
  );
  const pendingFieldId = useRef(0);
  const [showAiGen, setShowAiGen] = useState(false);
  const [showGuidedStart, setShowGuidedStart] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showDemoGallery, setShowDemoGallery] = useState(false);
  const [reviewedVariantUndo, setReviewedVariantUndo] = useState<{
    variantId: string;
    revision: number;
    sourceId: string;
  } | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>("free");
  // The plan comes from the beta's free Go period, and how long that lasts.
  const [planBeta, setPlanBeta] = useState<{ active: boolean; endsAt: number | null; days: number }>({
    active: false,
    endsAt: null,
    days: 0,
  });
  const [cloudUser, setCloudUser] = useState<AccountUser | null>(null);
  // Browser CVs never copied to the signed-in account (one-time banner).
  // CVs saved in this browser while signed in: all of them, and the ones that
  // can still be copied (own CVs never copied before).
  const [browserCvs, setBrowserCvs] = useState<{
    total: number;
    pending: ResumeDocument[];
  } | null>(null);
  const [browserCvsCheck, setBrowserCvsCheck] = useState(0);
  const rewriteAvailability = useRewriteAvailability(cloudUser?.id ?? null);
  // One-time AI consent on the account; set here once the person turns it on.
  const [aiConsentSet, setAiConsentSet] = useState<boolean | null>(null);
  useEffect(() => setAiConsentSet(null), [cloudUser?.id]);
  const aiConsent =
    aiConsentSet ??
    (typeof rewriteAvailability === "object" && rewriteAvailability
      ? Boolean(rewriteAvailability.aiConsent)
      : false);
  // Sign in to use AI: after signing in, the open draft is copied to the account.
  const aiSignIn = useRef(false);
  // Build my CV with AI: the CV the interview is filling, and a guest's wish to start one.
  const [interviewDocId, setInterviewDocId] = useState<string | null>(null);
  const pendingInterview = useRef(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const paused = useRef(false);
  const preview = useRef<PreviewHandle>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const future = useRef<ResumeDocument[]>([]);
  const [mobileTab, setMobileTab] = useState("editor");
  const [staged, setStaged] = useState<StagedImportData | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  // Findings the person dismissed for the open CV (kept in this browser).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const openDocId = doc?.id;
  useEffect(() => {
    setDismissed(openDocId ? loadDismissed(openDocId) : new Set());
  }, [openDocId]);

  // Docked side panels leave the editor usable, so they are not modal.
  const isModalActive = Boolean(
    showAccount ||
    showAiGen ||
    showGuidedStart ||
    showDemoGallery ||
    showPricing ||
    showHistory ||
    showAddSection ||
    showShortcuts ||
    staged,
  );
  useBodyScrollLock(isModalActive);

  const repository = useRef<ReturnType<typeof createRepository> | null>(null);
  const current = useRef<ResumeDocument | null>(null);
  const revisions = useRef(new Map<string, number>());
  const history = useRef<ResumeDocument[]>([]);
  const change = useRef(0);
  const savedChange = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  // The start screen replaces an empty library and opens from New CV.
  const startVisible =
    showStart || (!doc && (!showLibrary || !documents.length));
  const cloudUserId = cloudUser?.id;
  useEffect(() => {
    setBrowserCvs(null);
    if (!cloudUserId) return;
    let active = true;
    void Promise.all([createRepository().list(), importReceipts(cloudUserId)])
      .then(([local, receipts]) => {
        const copied = new Set(receipts.map((receipt) => receipt.source_id));
        const pending = local.filter(
          (item) =>
            !copied.has(item.id) && item.provenance.purpose !== "practice",
        );
        if (active)
          setBrowserCvs(local.length ? { total: local.length, pending } : null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [cloudUserId, browserCvsCheck]);

  function select(next: ResumeDocument) {
    // Coming from the start screen or library, begin at the top of the form
    // rather than wherever that page was scrolled.
    if (current.current?.id !== next.id) window.scrollTo({ top: 0 });
    setShowLibrary(false);
    setShowStart(false);
    setShowAI(false);
    clearTimeout(timer.current);
    current.current = next;
    setDoc(next);
    history.current = [];
    future.current = [];
    setUndoCount(0);
    setRedoCount(0);
    change.current = 0;
    savedChange.current = 0;
    setSectionId("contact");
    setFocusTarget(null);
    setError("");
    setStatus("Saved in this browser");
  }

  useEffect(() => {
    let active = true;
    repository.current = createRepository();
    repository.current
      .list()
      .then(async (list) => {
        if (!active) return;
        const session = (await accountRequest("/api/account").catch(
          () => null,
        )) as { user: AccountUser | null } | null;
        if (!active) return;
        setSessionUser(session?.user ?? null);
        // A device-workspace request (from the grader hand-off or an explicit
        // switch) applies to this page load only; signed-in users otherwise
        // always open their account.
        const deviceRequested =
          sessionStorage.getItem("cv-workspace") === "device";
        sessionStorage.removeItem("cv-workspace");
        if (session?.user && !deviceRequested) {
          const cloud = createCloudRepository(session.user.id);
          const cloudList = await cloud.list();
          if (!active) return;
          repository.current = cloud;
          setCloudUser(session.user);
          list = cloudList;
        }
        list.forEach((d) => revisions.current.set(d.id, d.revision));
        setDocuments(list);
        setStatus("Saved in this browser");
      })
      .catch((e) => {
        if (active) {
          setStatus("Save failed");
          setError(e.message);
        }
      });
    const warn = (event: BeforeUnloadEvent) => {
      if (change.current !== savedChange.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      active = false;
      clearTimeout(timer.current);
      window.removeEventListener("beforeunload", warn);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let checking = false;
    const stop = watchSessionChanges(() => {
      if (checking) return;
      checking = true;
      void accountRequest("/api/account")
        .then((value) => {
          if (!active) return;
          const user = (value as { user: AccountUser | null }).user;
          setSessionUser((previous) =>
            previous?.id === user?.id &&
            previous?.emailVerified === user?.emailVerified &&
            previous?.canExport === user?.canExport
              ? previous
              : user,
          );
          if (cloudUser && user?.id !== cloudUser.id) {
            paused.current = true;
            setSessionPaused(true);
            clearTimeout(timer.current);
            setShowAI(false);
            setError(
              "Your account session changed or expired. This workspace is paused; your draft is kept. Sign in to the original account or keep a copy on this device before switching.",
            );
          } else if (cloudUser && paused.current && user?.id === cloudUser.id) {
            paused.current = false;
            setSessionPaused(false);
            setNotice(
              "Original account session restored. Retry saving your kept draft.",
            );
          }
        })
        .catch(() => {})
        .finally(() => {
          checking = false;
        });
    });
    return () => {
      active = false;
      stop();
    };
  }, [cloudUser]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("billing=success")
    ) {
      setNotice(
        "Checkout returned. Your subscription status will update after payment is confirmed.",
      );
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Guests get the free plan from the same endpoint.
    let active = true;
    fetch("/api/billing/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const planId = normalizePlanId(data?.subscription?.planId);
        setIsSubscriber(planId !== "free");
        setCurrentPlanId(planId);
        setPlanBeta({
          active: Boolean(data?.subscription?.beta),
          endsAt: data?.subscription?.currentPeriodEnd ?? null,
          days: Number(data?.betaTrialDays ?? 0),
        });
      })
      .catch(() => {
        if (active) {
          setIsSubscriber(false);
          setCurrentPlanId("free");
        }
      });
    return () => {
      active = false;
    };
  }, [sessionUser]);

  async function flush() {
    clearTimeout(timer.current);
    const task = chain.current
      .catch(() => {})
      .then(async () => {
        if (paused.current)
          throw new Error(
            "Sign in to the original account to save. Your draft is kept.",
          );
        const snapshot = current.current;
        if (!snapshot || savedChange.current === change.current) return;
        const version = change.current;
        setStatus("Saving…");
        try {
          const saved = await repository.current!.save(
            snapshot,
            revisions.current.get(snapshot.id) ?? null,
          );
          revisions.current.set(saved.id, saved.revision);
          savedChange.current = version;
          setDocuments((list) => [
            saved,
            ...list.filter((d) => d.id !== saved.id),
          ]);
          setError("");
          setStatus(
            version === change.current
              ? "Saved in this browser"
              : "Unsaved changes",
          );
        } catch (e) {
          if (
            cloudUser &&
            e instanceof CloudRequestError &&
            (e.status === 401 || e.code === "WORKSPACE_CHANGED")
          ) {
            paused.current = true;
            setSessionPaused(true);
            clearTimeout(timer.current);
          }
          setStatus("Save failed");
          setError((e as Error).message);
          throw e;
        }
      });
    chain.current = task;
    return task;
  }

  function update(mutator: (draft: ResumeDocument) => void, record = true) {
    if (!current.current) return;
    const before = current.current;
    const next = structuredClone(before);
    mutator(next);
    if (
      sectionId !== "contact" &&
      !next.sections.some((s) => s.id === sectionId)
    )
      setSectionId("contact");
    if (record) {
      history.current.push(before);
      if (history.current.length > 80) history.current.shift();
      future.current = [];
    }
    current.current = next;
    change.current++;
    setDoc(next);
    setUndoCount(history.current.length);
    setRedoCount(future.current.length);
    setStatus("Unsaved changes");
    clearTimeout(timer.current);
    if (!paused.current)
      timer.current = setTimeout(() => {
        void flush().catch(() => {});
      }, 450);
  }

  function handleUndo() {
    const old = history.current.pop();
    if (!old || !current.current) return;
    future.current.push(current.current);
    update((d) => Object.assign(d, old), false);
  }

  function handleRedo() {
    const next = future.current.pop();
    if (!next || !current.current) return;
    history.current.push(current.current);
    update((d) => Object.assign(d, next), false);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showShortcuts) {
          e.preventDefault();
          setShowShortcuts(false);
          return;
        }
        if (showPricing) {
          e.preventDefault();
          setShowPricing(false);
          return;
        }
        if (showAts) {
          e.preventDefault();
          setShowAts(false);
          return;
        }
        if (showHistory) {
          e.preventDefault();
          setShowHistory(false);
          return;
        }
        if (showAddSection) {
          e.preventDefault();
          setShowAddSection(false);
          return;
        }
        if (showAccount) {
          e.preventDefault();
          setShowAccount(false);
          return;
        }
        if (showDemoGallery) {
          e.preventDefault();
          setShowDemoGallery(false);
          return;
        }
        if (activePanel) {
          e.preventDefault();
          setActivePanel(null);
          return;
        }
        if (staged) {
          e.preventDefault();
          setStaged(null);
          return;
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // Global Undo/Redo: Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y when NOT typing in a field
      const key = e.key.toLowerCase();
      const redo =
        (e.ctrlKey || e.metaKey) &&
        ((key === "z" && e.shiftKey) || (key === "y" && !e.shiftKey));
      if ((e.ctrlKey || e.metaKey) && (redo || (key === "z" && !e.shiftKey))) {
        const isAnyModalOpen =
          showAccount ||
          showPricing ||
          showHistory ||
          showAddSection ||
          showShortcuts ||
          showAiGen ||
          showGuidedStart ||
          showDemoGallery ||
          !!staged;

        if (!isEditable) {
          e.preventDefault();
          if (!isAnyModalOpen) {
            if (redo) handleRedo();
            else handleUndo();
          }
          return;
        }
      }

      // '?' (Shift + /) toggles the Keyboard Shortcuts Modal when NOT typing in an editable field
      if (e.key === "?" && !isEditable && !isModalActive) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showShortcuts,
    showPricing,
    showAts,
    showHistory,
    showAddSection,
    showAccount,
    showAI,
    showGuidedStart,
    isModalActive,
    showDesign,
    activePanel,
    showAiGen,
    showDemoGallery,
    staged,
  ]);

  async function action(work: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await flush();
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addDocument(next: ResumeDocument) {
    const saved = await repository.current!.save(next, null);
    revisions.current.set(saved.id, saved.revision);
    setDocuments((list) => [saved, ...list]);
    select(saved);
  }

  function undoReviewedVariant() {
    const receipt = reviewedVariantUndo;
    if (!receipt || current.current?.id !== receipt.variantId) return;
    void action(async () => {
      const list = await repository.current!.list();
      const source = list.find((item) => item.id === receipt.sourceId);
      const variant = list.find((item) => item.id === receipt.variantId);
      if (!source || !variant)
        throw new Error(
          "The original or variant is no longer available. Reload the workspace.",
        );
      if (variant.revision !== receipt.revision)
        throw new Error(
          "The variant has been edited since creation. Your edits are kept; creation cannot be undone now.",
        );
      await repository.current!.remove(variant.id, receipt.revision);
      revisions.current.delete(variant.id);
      revisions.current.set(source.id, source.revision);
      setDocuments(list.filter((item) => item.id !== variant.id));
      select(source);
      setReviewedVariantUndo(null);
      setNotice("Reviewed variant removed. Your original CV is open.");
    });
  }

  function duplicateSavedDocument(source: ResumeDocument) {
    void action(async () => {
      const latest = (await repository.current!.list()).find(
        (item) => item.id === source.id,
      );
      if (!latest)
        throw new Error(
          "This resume is no longer available. Reload the workspace.",
        );
      await addDocument(duplicateDocument(latest));
    });
  }

  function deleteSavedDocument(source: ResumeDocument) {
    if (
      !window.confirm(
        `Delete “${source.name}” from ${cloudUser ? "your account" : "this browser"}? Export a backup first if you need to keep it.`,
      )
    )
      return;
    void action(async () => {
      await repository.current!.remove(
        source.id,
        revisions.current.get(source.id)!,
      );
      revisions.current.delete(source.id);
      setDocuments(await repository.current!.list());
      if (current.current?.id === source.id) {
        current.current = null;
        setDoc(null);
      }
      setShowLibrary(true);
      setNotice(
        `Deleted “${source.name}” from ${cloudUser ? "your account" : "this browser"}.`,
      );
    });
  }

  function clearStartingDesign() {
    setSelectedStart(null);
    const query = new URLSearchParams(window.location.search);
    query.delete("template");
    query.delete("example");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query.size ? `?${query}` : ""}`,
    );
  }

  function createSelectedResume() {
    void action(async () => {
      const next = createDocument();
      if (selectedStart) {
        next.presentation = structuredClone(selectedStart.presentation);
        if (selectedStart.exampleId)
          next.provenance = {
            purpose: "personal",
            origin: "example",
            exampleId: selectedStart.exampleId,
          };
      }
      await addDocument(next);
      if (selectedStart) clearStartingDesign();
    });
  }

  /**
   * Signed in while the open CV is still the copy saved in this browser (for
   * example after signing in mid-edit): copy it to the account and open the
   * account copy. The browser copy is kept.
   */
  function copyCurrentToAccount(signedIn?: AccountUser) {
    const user = signedIn ?? sessionUser;
    const source = current.current;
    if (!user || !source || cloudUser || sessionPaused) return Promise.resolve();
    return action(async () => {
      await flush();
      const latest =
        (await repository.current!.list()).find((d) => d.id === source.id) ??
        source;
      let [result] = await transferLocalResumes(user.id, [latest]);
      // Copied before: send the current version as a new copy so the latest
      // edits reach the account.
      if (result.status === "already_imported")
        [result] = await transferLocalResumes(user.id, [
          duplicateDocument(latest, latest.name),
        ]);
      await switchWorkspace(user, false);
      const copy = (await repository.current!.list()).find(
        (d) => d.id === result.resumeId,
      );
      if (copy) select(copy);
      setNotice(
        "This CV is now saved to your account, so AI rewriting is available. The copy in this browser was kept.",
      );
    });
  }

  /**
   * Build my CV with AI: a new account CV filled by the AI interview. Guests
   * sign in first; a CV list in this browser switches to the account.
   */
  function buildWithAi() {
    if (!sessionUser) {
      pendingInterview.current = true;
      signInForAi();
      return;
    }
    const user = sessionUser;
    void action(async () => {
      if (!cloudUser) await switchWorkspace(user, false);
      await startInterviewCv();
    });
  }

  async function startInterviewCv() {
    const next = createDocument();
    next.name = "My CV (AI interview)";
    await addDocument(next);
    setShowStart(false);
    setShowLibrary(false);
    setInterviewDocId(next.id);
  }

  /** Leaves the interview, optionally opening the summary or skills help. */
  function finishInterview(next: "summary" | "skills" | null) {
    setInterviewDocId(null);
    if (!doc || !next) return;
    const section = doc.sections.find((s) => s.type === next);
    startFieldAction({
      id: `interview-${next}`,
      kind: next,
      action:
        next === "summary"
          ? planAllows(currentPlanId, "ai-summary")
            ? "ai-draft"
            : "draft"
          : planAllows(currentPlanId, "ai-skills")
            ? "ai-skills"
            : "skills",
      title: "",
      detail: "",
      buttonLabel: "",
      sectionId: section?.id ?? null,
      sectionType: next,
    });
  }

  /** Guests: sign in, then the open draft is copied to the account in one step. */
  function signInForAi() {
    aiSignIn.current = true;
    setShowAI(false);
    setShowAccount(true);
  }

  async function grantAiConsent() {
    await accountRequest(
      "/api/account",
      { method: "PATCH", body: JSON.stringify({ aiWritingHelp: true }) },
      cloudUser?.id,
    );
    setAiConsentSet(true);
  }

  /** Opens the start screen; the open CV stays as it is underneath. */
  function openStart() {
    void action(async () => {
      setShowStart(true);
    });
  }

  async function handleSignedOut(deleted?: boolean) {
    setSessionUser(null);
    if (deleted) {
      paused.current = false;
      setSessionPaused(false);
    }
    if (!deleted && cloudUser && current.current) {
      paused.current = true;
      setSessionPaused(true);
      setError(
        "Signed out. Your account draft is kept in this tab. Sign in again or keep a copy on this device.",
      );
    } else await switchWorkspace(null, false);
  }

  /** Sign out from the account menu, keeping the current draft safe first. */
  async function signOut() {
    await action(async () => {
      await accountRequest("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "signout" }),
      });
      notifySessionChange();
      await handleSignedOut();
      setNotice("Signed out. CVs saved in this browser stay here.");
    });
  }

  async function switchWorkspace(user: AccountUser | null, save = true) {
    if (cloudUser && current.current && paused.current) {
      if (user?.id === cloudUser.id) {
        paused.current = false;
        setSessionPaused(false);
        setSessionUser(user);
        await flush();
        return;
      }
      throw new Error(
        "Keep the paused draft on this device before switching accounts.",
      );
    }
    if (!current.current) {
      paused.current = false;
      setSessionPaused(false);
    }
    if (save) await flush();
    paused.current = false;
    setSessionPaused(false);
    sessionStorage.setItem("cv-workspace", user ? "account" : "device");
    clearTimeout(timer.current);
    current.current = null;
    setDoc(null);
    setDocuments([]);
    setShowLibrary(true);
    setShowAI(false);
    setShowAts(false);
    setShowHistory(false);
    setShowDesign(false);
    setDesignFilter("all");
    setReviewedVariantUndo(null);
    setStaged(null);
    history.current = [];
    future.current = [];
    setUndoCount(0);
    setRedoCount(0);
    change.current = savedChange.current = 0;
    const next = user ? createCloudRepository(user.id) : createRepository();
    repository.current = next;
    setCloudUser(user);
    setStatus("Loading");
    try {
      const list = await next.list();
      revisions.current = new Map(list.map((d) => [d.id, d.revision]));
      setDocuments(list);
      setError("");
      setStatus("Saved in this browser");
    } catch (error) {
      setStatus("Save failed");
      setError((error as Error).message);
      throw error;
    }
  }

  async function classifyDocument(
    target: ResumeDocument,
    purpose: "personal" | "practice",
  ) {
    if (
      purpose === "personal" &&
      !window.confirm(
        "Confirm that you have reviewed this CV and its details describe your own experience. Example facts must be replaced first.",
      )
    )
      return;
    await action(async () => {
      const saved = await repository.current!.save(
        {
          ...target,
          provenance: { ...target.provenance, purpose },
        },
        revisions.current.get(target.id) ?? target.revision,
      );
      revisions.current.set(saved.id, saved.revision);
      setDocuments((list) =>
        list.map((item) => (item.id === saved.id ? saved : item)),
      );
      if (current.current?.id === saved.id) select(saved);
      setNotice(
        purpose === "personal"
          ? "Moved to personal CVs."
          : "Moved to practice copies.",
      );
    });
  }

  async function prepareAI() {
    await flush();
    if (!current.current || !cloudUser)
      throw new Error("Open an account resume first.");
    return {
      ...current.current,
      revision:
        revisions.current.get(current.current.id) ?? current.current.revision,
    };
  }

  async function acceptAI(proposal: Proposal, bulletIds?: string[]) {
    const before = await prepareAI();
    if (
      proposal.documentId !== before.id ||
      proposal.baseRevision !== before.revision
    )
      throw new Error("The resume changed. Generate a new suggestion.");
    const result = (await accountRequest(
      `/api/ai/${encodeURIComponent(proposal.id)}`,
      {
        method: "POST",
        body: JSON.stringify({
          decision: "accept",
          confirmed: true,
          ...(bulletIds ? { bulletIds } : {}),
        }),
      },
      cloudUser!.id,
    )) as { document: unknown };
    const saved = documentSchema.parse(result.document);
    history.current.push(before);
    if (history.current.length > 80) history.current.shift();
    current.current = saved;
    revisions.current.set(saved.id, saved.revision);
    setDoc(saved);
    setUndoCount(history.current.length);
    setDocuments((list) => [saved, ...list.filter((d) => d.id !== saved.id)]);
    savedChange.current = change.current;
    setError("");
    setStatus("Saved in this browser");
  }

  function checkedExport(format: ExportFormat | "print", recovery = false) {
    if (!current.current) return;
    const pending: PendingExport = {
      doc: structuredClone(current.current),
      owner: cloudUser?.id ?? null,
      format,
      recovery,
    };
    setPendingExport(pending);
    void performExport(pending);
  }

  async function performExport(pending: PendingExport, signedIn?: AccountUser) {
    setBusy(true);
    if (!pending.recovery) setError("");
    try {
      const user =
        signedIn ??
        ((await accountRequest("/api/account")) as { user: AccountUser | null })
          .user;
      setSessionUser(user);
      if (!user) {
        setPendingExport(pending);
        setShowAI(false);
        setShowAccount(true);
        setNotice("Sign in to export. Your CV and chosen format are kept.");
        return;
      }
      if (pending.owner && pending.owner !== user.id)
        throw new Error(
          "This CV belongs to a different account workspace. Sign in to the original account; your edits are kept.",
        );
      if (!userCanExport(user)) {
        setPendingExport(pending);
        setShowAI(false);
        setShowAccount(true);
        setNotice(
          "Verify your email to continue exporting. Your CV and chosen format are kept.",
        );
        return;
      }
      if (pending.owner === user.id) {
        paused.current = false;
        setSessionPaused(false);
      }
      let snapshot = pending.doc;
      if (!pending.recovery) {
        await flush();
        if (current.current?.id === snapshot.id)
          snapshot = {
            ...structuredClone(current.current),
            revision: revisions.current.get(snapshot.id) ?? snapshot.revision,
          };
      }
      let source: ExportSource;
      if (pending.owner && !pending.recovery) {
        source = {
          storage: "account",
          documentId: snapshot.id,
          revision: snapshot.revision,
        };
      } else {
        if (
          !window.confirm(
            "Send this CV snapshot to the server to prepare your export? This request does not save or change a CV in your account. Your current draft stays in the editor.",
          )
        ) {
          setPendingExport(null);
          return;
        }
        source = {
          storage: "device",
          document: snapshot,
          processingConsent: true,
        };
      }
      const input: ExportRequest = pending.letter
        ? {
            kind: "letter",
            source,
            format: pending.format as "txt" | "md" | "copy" | "print",
            ...pending.letter,
          }
        : {
            kind: "resume",
            source,
            format: pending.format as ExportFormat | "print",
          };
      const artifact = await requestExport(input, user.id);
      if (pending.format === "print") await printArtifact(artifact.blob);
      else if (pending.format === "copy")
        await navigator.clipboard.writeText(await artifact.blob.text());
      else downloadArtifact(artifact.blob, artifact.filename);
      setPendingExport(null);
      setNotice(
        pending.format === "copy"
          ? "Cover letter copied."
          : pending.format === "print"
            ? "Authorized print preview opened."
            : "Export downloaded.",
      );
    } catch (error) {
      if (
        error instanceof CloudRequestError &&
        (error.status === 401 || error.code === "EMAIL_VERIFICATION_REQUIRED")
      ) {
        setPendingExport(pending);
        setShowAI(false);
        setShowAccount(true);
      }
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stageFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("Backup exceeds the 5 MB limit.");
      const text = await file.text();
      const trimmed = text.trim();
      const isJson =
        file.name.endsWith(".json") ||
        file.type === "application/json" ||
        (trimmed.startsWith("{") && trimmed.endsWith("}"));
      if (isJson) {
        setStaged({
          document: parseBackup(text),
          warnings: [],
          sourceFile: file.name,
        });
      } else if (file.name.endsWith(".csv") && isLinkedInCsv(text)) {
        const parsed = parseLinkedInArchive(
          { [file.name]: text },
          file.name.replace(/\.csv$/i, ""),
        );
        setStaged({
          document: parsed.document,
          warnings: parsed.warnings,
          sourceFile: file.name,
        });
      } else {
        const parsed = parseTextToResume(text, file.name);
        setStaged({
          document: parsed.document,
          warnings: parsed.warnings,
          sourceFile: file.name,
        });
      }
      setError("");
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "This file is not valid JSON. No resume was changed."
          : (e as Error).message,
      );
    }
  }

  function handlePreviewBlockClick(block: LayoutBlock) {
    if (
      ["name", "headline", "location", "email", "phone", "website"].includes(
        block.id,
      ) ||
      block.kind === "name" ||
      block.kind === "headline" ||
      block.kind === "contact"
    ) {
      setSectionId("contact");
      setFocusTarget({ sectionId: "contact", field: block.id });
      setMobileTab("editor");
      return;
    }

    for (const s of doc?.sections || []) {
      if (s.id === block.id) {
        setSectionId(s.id);
        setFocusTarget({ sectionId: s.id });
        setMobileTab("editor");
        return;
      }
      for (const e of s.entries) {
        for (const b of e.bullets) {
          if (b.id === block.id) {
            setSectionId(s.id);
            setFocusTarget({ sectionId: s.id, entryId: e.id, bulletId: b.id });
            setMobileTab("editor");
            return;
          }
        }
        if (
          e.id === block.group ||
          `${e.id}-title` === block.id ||
          `${e.id}-meta` === block.id ||
          `${e.id}-description` === block.id
        ) {
          setSectionId(s.id);
          setFocusTarget({ sectionId: s.id, entryId: e.id });
          setMobileTab("editor");
          return;
        }
      }
    }
  }

  const ready = status !== "Loading";
  const allIssues = useMemo(
    () => (doc ? lintResumeDocument(doc).issues : []),
    [doc],
  );
  const openIssues = useMemo(
    () => allIssues.filter((issue) => !dismissed.has(issue.id)),
    [allIssues, dismissed],
  );
  const strength = useMemo(
    () =>
      doc
        ? cvStrength(doc, openIssues)
        : { percent: 0, items: [], next: null, steps: {} },
    [doc, openIssues],
  );
  function setDismissedFor(id: string, isDismissed: boolean) {
    if (!doc) return;
    const next = new Set(dismissed);
    if (isDismissed) next.add(id);
    else next.delete(id);
    setDismissed(next);
    saveDismissed(doc.id, next);
  }
  /** Show the field a finding is about, keeping the docked panel open. */
  function fixIssue(issue: AtsLintIssue) {
    const sectionId = issue.sectionId || "contact";
    setSectionId(sectionId);
    setMobileTab("editor");
    const contactField = issue.id.startsWith("contact-")
      ? issue.id.slice("contact-".length)
      : undefined;
    setFocusTarget({
      sectionId,
      entryId: issue.entryId,
      bulletId: issue.bulletId,
      field: contactField,
    });
    // A bottom sheet would cover the field.
    if (sheetLayout) setShowAts(false);
  }
  const steps = doc
    ? [
        { id: "contact", label: "Personal details" },
        ...doc.sections.map((s) => ({
          id: s.id,
          label: s.label || labels[s.type],
        })),
      ]
    : [];
  /** Saves a reviewed job variant as its own CV, keeping the original. */
  async function applyTailoredVariant(
    tailored: ResumeDocument,
    sourceSnapshot: string,
  ) {
    let succeeded = false;
    await action(async () => {
      const active = current.current!;
      const snapshot = {
        ...active,
        revision: revisions.current.get(active.id) ?? active.revision,
      };
      const list = await repository.current!.list();
      const latest = list.find((item) => item.id === snapshot.id);
      if (
        reviewSnapshot(snapshot) !== sourceSnapshot ||
        !latest ||
        reviewSnapshot(latest) !== sourceSnapshot
      ) {
        throw new Error(
          "The source CV changed or was removed after review. Reload it and analyze the current snapshot again.",
        );
      }
      const alreadySaved = list.find((item) => item.id === tailored.id);
      if (alreadySaved) {
        if (reviewSnapshot(alreadySaved) !== reviewSnapshot(tailored)) {
          throw new Error(
            "This pending variant already exists with later changes. Your edits are kept; reload to review it.",
          );
        }
        revisions.current.set(alreadySaved.id, alreadySaved.revision);
        setDocuments(list);
        select(alreadySaved);
      } else {
        await addDocument(tailored);
      }
      setReviewedVariantUndo({
        variantId: tailored.id,
        revision: revisions.current.get(tailored.id)!,
        sourceId: snapshot.id,
      });
      setNotice(
        "Reviewed ordering saved in an independent variant. Your original CV is kept.",
      );
      succeeded = true;
    });
    return succeeded;
  }

  /**
   * From the AI Assistant's to-do list: show the field an item is about and
   * open its sparkle action there.
   */
  function startFieldAction(item: HelpItem) {
    if (!doc) return;
    let sectionId = item.sectionId;
    let entryId = item.entryId;
    if (item.kind !== "bullet") {
      const existing = sectionId
        ? doc.sections.find((s) => s.id === sectionId)
        : undefined;
      if (!existing || !existing.entries.length) {
        const newId = existing?.id ?? uid();
        sectionId = newId;
        entryId = uid();
        const entryTitle = item.kind === "summary" ? "Summary" : "Skills";
        update((d) => {
          let section = d.sections.find((s) => s.id === newId);
          if (!section) {
            section = {
              id: newId,
              type: item.sectionType === "summary" ? "summary" : "skills",
              label:
                item.sectionType === "summary"
                  ? "Professional Summary"
                  : "Technical Skills",
              visible: true,
              entries: [],
            };
            if (item.sectionType === "summary") d.sections.unshift(section);
            else d.sections.push(section);
          }
          section.entries.push({
            ...newEntry(),
            id: entryId!,
            title: entryTitle,
          });
        });
      } else {
        entryId = existing.entries[0].id;
      }
    }
    if (!sectionId) return;
    goToStep(sectionId, false);
    setFocusTarget({ sectionId, entryId, bulletId: item.bulletId });
    pendingFieldId.current += 1;
    setPendingField({
      id: pendingFieldId.current,
      kind: item.kind,
      action: item.action,
      bulletId: item.bulletId,
    });
    // A bottom sheet would cover the field.
    if (sheetLayout) setShowAI(false);
  }
  useEffect(() => {
    if (!pendingField) return;
    const timer = setTimeout(() => setPendingField(null), 1500);
    return () => clearTimeout(timer);
  }, [pendingField]);

  /** Check my CV: run Improve wording or Shorten on the finding's bullet. */
  function fixIssueWithAi(issue: AtsLintIssue) {
    const action = aiFixFor(issue);
    if (!doc || !action || !issue.bulletId) return;
    const section = doc.sections.find((s) => s.id === issue.sectionId);
    startFieldAction({
      id: `check-${issue.id}`,
      kind: "bullet",
      action,
      title: "",
      detail: "",
      buttonLabel: "",
      sectionId: issue.sectionId ?? null,
      sectionType: section?.type === "projects" ? "projects" : "experience",
      entryId: issue.entryId,
      bulletId: issue.bulletId,
    });
    if (sheetLayout) setShowAts(false);
  }

  /** Show a step and, unless a field will take focus, move focus to its form. */
  function goToStep(id: string, focusForm = true) {
    setSectionId(id);
    setMobileTab("editor");
    requestAnimationFrame(() => {
      const form = document.querySelector<HTMLElement>(".editor-panel");
      form?.scrollIntoView({ block: "start", behavior: "instant" });
      if (focusForm) form?.focus({ preventScroll: true });
    });
  }

  // Everything a sparkle menu or AI view needs; shared by the form and the AI Assistant.
  const fieldAiServices: FieldAiServices | null = doc
    ? {
      doc,
      owner: cloudUser?.id ?? null,
      availability: rewriteAvailability,
      signedIn: !!sessionUser,
      onCopyToAccount: () => void copyCurrentToAccount(),
      summaryDrafts: planAllows(currentPlanId, "ai-summary"),
      aiConsent,
      grantConsent: grantAiConsent,
      starterTitle: starterTitle(doc),
      skillsAi: planAllows(currentPlanId, "ai-skills"),
      updateDocument: (mutator) => update(mutator),
      onSeePlans: () => setShowPricing(true),
      prepare: prepareAI,
      accept: acceptAI,
      onOpenAccount: signInForAi,
      pending: pendingField,
      consumePending: (id) =>
        setPendingField((open) => (open?.id === id ? null : open)),
      improveAll: planAllows(currentPlanId, "ai-improve-all"),
      jobMatch: planAllows(currentPlanId, "ai-job-match"),
      tailor: planAllows(currentPlanId, "ai-tailor"),
      saveTailoredCopy: applyTailoredVariant,
    }
    : null;

  return (
    <div
      className="studio"
      onFocusCapture={(event) =>
        rememberWorkspaceFocus(event.target as HTMLElement)
      }
    >
      {!showAccount && !showAI && (
        <a
          className="workspace-skip no-print"
          href="#workspace-main"
          onClick={() => {
            setMobileTab("editor");
            requestAnimationFrame(() =>
              document.getElementById("workspace-main")?.focus(),
            );
          }}
        >
          Skip to workspace
        </a>
      )}
      <EditorHeader
        libraryMode={showLibrary || startVisible}
        // "New CV" only when asked for; an empty My CVs keeps its name.
        heading={showStart ? "New CV" : "My CVs"}
        cloudUser={cloudUser}
        sessionUser={sessionUser}
        status={status}
        busy={busy}
        ready={ready}
        showAccount={showAccount}
        onOpenAccount={() => setShowAccount(true)}
        onSignOut={() => void signOut()}
        onUseAccount={
          sessionUser && !sessionPaused
            ? () => {
                const user = sessionUser;
                void action(() => switchWorkspace(user));
              }
            : undefined
        }
        onOpenLibrary={() => {
          void action(async () => {
            setShowStart(false);
            setShowLibrary(true);
          });
        }}
        onOpenPricing={() => setShowPricing(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        isSubscriber={isSubscriber}
        onNavigate={(href) => {
          void action(async () => {
            window.location.assign(href);
          });
        }}
      />

      {showAccount && (
        <PanelDialog
          label="Account settings"
          onClose={() => {
            setShowAccount(false);
            setPendingExport(null);
          }}
        >
          <AccountPanel
            cloudOwner={cloudUser?.id ?? null}
            beforeChange={
              pendingExport || sessionPaused ? async () => {} : flush
            }
            pendingAction={pendingExport ? "Continue export" : undefined}
            onAiWritingHelp={setAiConsentSet}
            onAuthenticated={async (user) => {
              setSessionUser(user);
              if (!cloudUser && current.current)
                sessionStorage.setItem("cv-workspace", "device");
              if (cloudUser?.id === user.id) {
                paused.current = false;
                setSessionPaused(false);
              }
              if (pendingExport) {
                if (userCanExport(user)) setShowAccount(false);
                await performExport(pendingExport, user);
              } else if (aiSignIn.current && !cloudUser) {
                aiSignIn.current = false;
                setShowAccount(false);
                if (pendingInterview.current) {
                  pendingInterview.current = false;
                  await action(async () => {
                    await switchWorkspace(user, false);
                    await startInterviewCv();
                  });
                } else if (current.current) await copyCurrentToAccount(user);
                else await action(() => switchWorkspace(user));
              }
            }}
            onCloud={(user) => switchWorkspace(user)}
            onOpenPricing={() => {
              setShowAccount(false);
              setShowPricing(true);
            }}
            onSignedOut={handleSignedOut}
            onClose={() => {
              setShowAccount(false);
              setPendingExport(null);
              aiSignIn.current = false;
              pendingInterview.current = false;
            }}
            loadLocal={async () => {
              await flush();
              return createRepository().list();
            }}
            onTransfer={async (owner, docs) => {
              await flush();
              const result = await transferLocalResumes(owner, docs);
              if (cloudUser?.id === owner)
                await switchWorkspace(cloudUser, false);
              setBrowserCvsCheck((count) => count + 1);
              return `${result.filter((r) => r.status === "imported").length} resumes copied. Local originals were kept.`;
            }}
            onExport={async (owner) => {
              await flush();
              const data = await accountRequest(
                "/api/account/export",
                {},
                owner,
              );
              download(
                JSON.stringify(data, null, 2),
                "cv-builder-account.json",
                "application/json",
              );
            }}
          />
        </PanelDialog>
      )}

      {sessionPaused && doc && (
        <div className="alert no-print" role="status">
          Account workspace paused. Your draft stays in this tab.
          <button onClick={() => setShowAccount(true)}>
            Restore account session
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void chain.current
                .catch(() => {})
                .then(async () => {
                  const copy = duplicateDocument(current.current!);
                  const local = createRepository();
                  const saved = await local.save(copy, null);
                  paused.current = false;
                  setSessionPaused(false);
                  await switchWorkspace(null, false);
                  select(saved);
                  setNotice(
                    "Your draft was copied to this device. The original account CV was kept.",
                  );
                })
                .catch((error) => setError(error.message))
                .finally(() => setBusy(false));
            }}
          >
            Keep draft on this device
          </button>
        </div>
      )}

      {showAiGen && (
        <AiCvGeneratorModal
          currentDoc={doc}
          busy={busy}
          onApplyResume={(generated) => {
            void action(async () => {
              await addDocument(generated);
              setShowAiGen(false);
            });
          }}
          onClose={() => setShowAiGen(false)}
        />
      )}

      {showGuidedStart && (
        <GuidedStartModal
          onClose={() => setShowGuidedStart(false)}
          onCreate={async (draft) => {
            let saved = false;
            await action(async () => {
              if (selectedStart)
                draft.presentation = structuredClone(
                  selectedStart.presentation,
                );
              await addDocument(draft);
              if (selectedStart) clearStartingDesign();
              setShowGuidedStart(false);
              saved = true;
            });
            return saved;
          }}
        />
      )}

      {showDemoGallery && (
        <DemoResumesModal
          isOpen={showDemoGallery}
          onClose={() => setShowDemoGallery(false)}
          onUseDesign={(demoDoc, exampleId) => {
            void action(async () => {
              await addDocument(startFromDesign(demoDoc, exampleId));
              setShowDemoGallery(false);
              setShowDesign(false);
            });
          }}
        />
      )}

      {showPricing && (
        <PricingModal
          cloudUser={cloudUser}
          currentPlanId={currentPlanId}
          beta={planBeta.active}
          betaDays={planBeta.days}
          onOpenAccount={() => {
            setShowPricing(false);
            setShowAccount(true);
          }}
          onClose={() => setShowPricing(false)}
        />
      )}

      {showHistory && doc && (
        <VersionHistoryModal
          doc={doc}
          busy={busy}
          onRestore={(restored) => {
            update((d) => Object.assign(d, restored));
          }}
          onForkVariant={(forked) => {
            void action(async () => {
              await addDocument(forked);
            });
          }}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showAddSection && doc && (
        <AddSectionModal
          isOpen={showAddSection}
          onClose={() => setShowAddSection(false)}
          onAddSection={(newSec) => {
            update((d) => {
              d.sections.push(newSec);
            });
            setSectionId(newSec.id);
          }}
          existingSections={doc.sections}
          allDocuments={documents}
        />
      )}

      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {staged && (
        <ImportReviewModal
          staged={staged}
          hasActiveDoc={!!doc && !showStart}
          busy={busy}
          onRestoreAsNew={() => {
            void action(async () => {
              await addDocument(
                duplicateDocument(staged.document, staged.document.name),
              );
              setStaged(null);
            });
          }}
          onReplaceActive={
            doc && !showStart
              ? () => {
                  void action(async () => {
                    const imported = structuredClone(staged.document);
                    update((d) => {
                      d.contact = imported.contact;
                      d.sections = imported.sections;
                      d.presentation = imported.presentation;
                      d.provenance = imported.provenance;
                    });
                    setStaged(null);
                    await flush();
                  });
                }
              : undefined
          }
          onCancel={() => setStaged(null)}
        />
      )}

      <fieldset
        className="workspace-body"
        style={{ display: showAccount ? "none" : undefined }}
        disabled={
          showAccount ||
          showPricing ||
          showHistory ||
          showAddSection ||
          showShortcuts ||
          showAiGen ||
          showGuidedStart ||
          showDemoGallery ||
          !!staged
        }
        inert={
          showAccount ||
          showPricing ||
          showHistory ||
          showAddSection ||
          showShortcuts ||
          showAiGen ||
          showGuidedStart ||
          showDemoGallery ||
          !!staged
        }
      >
        {error && (
          <div className="alert no-print" role="alert">
            {error}{" "}
            <button
              onClick={() => {
                void flush().catch(() => {});
              }}
            >
              Retry save
            </button>
            {doc && (
              <button onClick={() => checkedExport("json", true)}>
                Download recovery backup
              </button>
            )}
          </div>
        )}
        {notice && (
          <p className="notice no-print" role="status">
            {notice}
          </p>
        )}
        {reviewedVariantUndo?.variantId === doc?.id && !showLibrary && (
          <div className="notice no-print" role="status">
            Your original CV is kept. Undo removes this variant only if it has
            no later edits.
            <button
              type="button"
              disabled={busy || sessionPaused}
              onClick={undoReviewedVariant}
            >
              Undo reviewed variant creation
            </button>
          </div>
        )}
        <input
          type="file"
          accept=".json,.csv,text/csv,application/json"
          ref={fileInput}
          hidden
          aria-label="Import JSON backup"
          onChange={(e) => {
            void stageFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {cloudUser && browserCvs && !(doc && !showLibrary && !showStart) && (
          <BrowserCvsBanner
            key={`${cloudUser.id}:${browserCvsCheck}`}
            userId={cloudUser.id}
            email={cloudUser.email}
            total={browserCvs.total}
            documents={browserCvs.pending}
            busy={busy || !ready}
            onShow={() => void action(() => switchWorkspace(null))}
            onDone={() => setBrowserCvsCheck((count) => count + 1)}
            onCopy={async (selected) => {
              await flush();
              const result = await transferLocalResumes(
                cloudUser.id,
                selected,
              );
              await switchWorkspace(cloudUser, false);
              setNotice(
                `${result.filter((r) => r.status === "imported").length} CVs copied to your account. The copies in this browser were kept.`,
              );
            }}
          />
        )}
        {startVisible ? (
          <StartScreen
            disabled={!ready || busy || status === "Save failed"}
            signedIn={!!cloudUser}
            betaDays={planBeta.days}
            onSignInForAi={sessionUser ? undefined : signInForAi}
            onBuildWithAi={buildWithAi}
            startingDesign={selectedStart?.label}
            onClearStartingDesign={clearStartingDesign}
            onStaged={(data) => setStaged(data)}
            onError={setError}
            onScratch={createSelectedResume}
            onGuided={() => setShowGuidedStart(true)}
            onExamples={() => setShowDemoGallery(true)}
            onPractice={() => setShowAiGen(true)}
            onRestoreBackup={() => fileInput.current?.click()}
            onBack={
              documents.length
                ? () => {
                    setShowStart(false);
                    if (!doc) setShowLibrary(true);
                  }
                : undefined
            }
          />
        ) : showLibrary || !doc ? (
          <>
            {selectedStart && (
              <section
                className="starting-design no-print"
                aria-label="Selected starting design"
              >
                <div>
                  <strong>Start with {selectedStart.label}</strong>
                  <p>
                    New CV will use this design with empty personal details.
                    Existing CVs stay unchanged.
                  </p>
                </div>
                <button disabled={busy || !ready} onClick={clearStartingDesign}>
                  Clear design choice
                </button>
              </section>
            )}
            <DocumentLibrary
              documents={documents}
              accountEmail={cloudUser?.email}
              busy={busy || !ready}
              onOpen={(next) => {
                void action(async () => {
                  select(next);
                });
              }}
              onDuplicate={duplicateSavedDocument}
              onDelete={deleteSavedDocument}
              onClassify={(next, purpose) => {
                void classifyDocument(next, purpose);
              }}
              onNew={openStart}
            />
          </>
        ) : (
          <>
            <EditorToolbar
              doc={doc}
              documents={documentsInCollection(
                documents,
                doc.provenance.purpose,
              )}
              busy={busy}
              canUndo={undoCount > 0}
              canRedo={redoCount > 0}
              status={status}
              savedToAccount={!!cloudUser}
              saveAction={
                cloudUser
                  ? undefined
                  : sessionUser
                    ? sessionPaused
                      ? undefined
                      : {
                          label: "Copy to my account",
                          onClick: () => void copyCurrentToAccount(),
                        }
                    : {
                        label: "Sign in to use AI",
                        onClick: signInForAi,
                      }
              }
              issueCount={issuesToFix(allIssues, dismissed).length}
              activePanel={activePanel}
              onRename={(name) =>
                update((d) => {
                  d.name = name || "Untitled resume";
                })
              }
              onSelectDocument={(id) => {
                void action(async () => {
                  const list = await repository.current!.list();
                  const next = list.find((d) => d.id === id);
                  if (!next)
                    throw new Error(
                      "This resume is no longer available. Reload the workspace.",
                    );
                  list.forEach((d) => revisions.current.set(d.id, d.revision));
                  setDocuments(list);
                  select(next);
                });
              }}
              onNew={openStart}
              onDelete={() => deleteSavedDocument(doc)}
              onDuplicate={() => {
                void action(() =>
                  addDocument(duplicateDocument(current.current!)),
                );
              }}
              onImportClick={() => fileInput.current?.click()}
              onOpenHistory={() => setShowHistory(true)}
              onOpenDemoGallery={() => setShowDemoGallery(true)}
              onOpenAiGenerator={() => setShowAiGen(true)}
              onMarkPersonal={
                doc.provenance.purpose !== "personal"
                  ? () => void classifyDocument(doc, "personal")
                  : undefined
              }
              onUndo={handleUndo}
              onRedo={handleRedo}
              onTogglePanel={(panel) =>
                setActivePanel((open) => (open === panel ? null : panel))
              }
              onPrint={() => checkedExport("print")}
              onExport={checkedExport}
            />

            <div className="mobile-tabs no-print">
              <button
                aria-pressed={mobileTab === "editor"}
                aria-controls="workspace-main"
                onClick={() => setMobileTab("editor")}
              >
                Edit details
              </button>
              <button
                aria-pressed={mobileTab === "preview"}
                aria-controls="resume-preview-panel"
                onClick={() => setMobileTab("preview")}
              >
                Preview resume
              </button>
            </div>

            <main
              id="workspace-main"
              tabIndex={-1}
              className={`editor-layout show-${mobileTab}${activePanel && !sheetLayout ? " has-panel" : ""}${activePanel === "design" && !sheetLayout ? " has-design" : ""}`}
            >
              <EditorSidebar
                doc={doc}
                sectionId={sectionId}
                strength={strength}
                onSelectSection={goToStep}
                onAddSection={() => setShowAddSection(true)}
                onNextStep={(id) => {
                  goToStep(id, false);
                  setFocusTarget({
                    sectionId: id,
                    field: id === "contact" ? "name" : undefined,
                  });
                }}
              />

              <FieldAiProvider value={fieldAiServices!}>
                {doc.id === interviewDocId ? (
                  <AiInterview doc={doc} onFinish={finishInterview} />
                ) : (
                <SectionEditor
                  doc={doc}
                  sectionId={sectionId}
                  busy={busy}
                  cloudUser={cloudUser}
                  focusTarget={focusTarget}
                  onOpenPhotoDesigns={() => {
                    setDesignFilter("photo");
                    setShowDesign(true);
                  }}
                  dismissed={dismissed}
                  onUpdateDocument={(mutator) => update(mutator)}
                  onDeleteSection={(secId) => {
                    update((d) => {
                      const idx = d.sections.findIndex((s) => s.id === secId);
                      if (idx !== -1) {
                        d.sections.splice(idx, 1);
                      }
                    });
                    setSectionId("contact");
                  }}
                  steps={steps}
                  onStep={goToStep}
                  onFinish={() => setShowAts(true)}
                />
                )}
              </FieldAiProvider>

              {activePanel && (
                <SidePanel
                  key={activePanel}
                  title={
                    activePanel === "design"
                      ? "Design"
                      : activePanel === "check"
                        ? "Check my CV"
                        : "AI Assistant"
                  }
                  onClose={() => {
                    setActivePanel(null);
                    setDesignFilter("all");
                  }}
                >
                  {activePanel === "design" && (
                    <DesignPanel
                      doc={doc}
                      disabled={busy}
                      onChange={(settings) =>
                        update((d) => {
                          Object.assign(d.presentation, settings);
                        })
                      }
                      initialFilter={designFilter}
                    />
                  )}
                  {activePanel === "check" && (
                    <CheckPanel
                      doc={doc}
                      strength={strength}
                      issues={allIssues}
                      dismissed={dismissed}
                      onDismiss={(id) => setDismissedFor(id, true)}
                      onRestore={(id) => setDismissedFor(id, false)}
                      onFix={fixIssue}
                      onFixWithAi={fixIssueWithAi}
                      onOpenStep={(id) => {
                        goToStep(id, false);
                        setFocusTarget({
                          sectionId: id,
                          field: id === "contact" ? "name" : undefined,
                        });
                        if (sheetLayout) setShowAts(false);
                      }}
                    />
                  )}
                  {activePanel === "ai" && (
                    <FieldAiProvider value={fieldAiServices!}>
                    <AIPanel
                      key={`${cloudUser?.id ?? "local"}:${doc.id}`}
                      doc={doc}
                      owner={cloudUser?.id ?? null}
                      availability={rewriteAvailability}
                      signedIn={!!sessionUser}
                      onCopyToAccount={() => void copyCurrentToAccount()}
                      onStartAction={startFieldAction}
                      onOpenAccount={signInForAi}
                      onOpenCheck={() => setActivePanel("check")}
                      jobTab={
                        <JobTailorModal
                          embedded
                          owner={cloudUser?.id ?? null}
                          prepareHistory={prepareAI}
                          acceptCoaching={acceptAI}
                          doc={{
                            ...doc,
                            revision:
                              revisions.current.get(doc.id) ?? doc.revision,
                          }}
                          busy={busy}
                          canCreateCopy={planAllows(
                            currentPlanId,
                            "tailored-copy",
                          )}
                          canCoach={planAllows(currentPlanId, "job-coaching")}
                          onSeePlans={() => {
                            if (sheetLayout) setShowAI(false);
                            setShowPricing(true);
                          }}
                          onApplyTailoredVariant={applyTailoredVariant}
                          onClose={() => setShowAI(false)}
                        />
                      }
                      letterTab={
                        !planAllows(currentPlanId, "cover-letter") ? (
                          <LockedFeature
                            feature="cover-letter"
                            onSeePlans={() => {
                              if (sheetLayout) setShowAI(false);
                              setShowPricing(true);
                            }}
                          />
                        ) : (
                        <CoverLetterModal
                          embedded
                          doc={doc}
                          busy={busy}
                          onClose={() => setShowAI(false)}
                          onExport={(format, text, name) => {
                            if (!current.current) return;
                            const pending: PendingExport = {
                              doc: structuredClone(current.current),
                              owner: cloudUser?.id ?? null,
                              format,
                              letter: { text, name },
                            };
                            setPendingExport(pending);
                            void performExport(pending);
                          }}
                        />
                        )
                      }
                    />
                    </FieldAiProvider>
                  )}
                </SidePanel>
              )}

              <section
                id="resume-preview-panel"
                className="preview-panel"
                aria-label="Live preview"
                // Design sits in the form's column so the preview stays visible.
                hidden={!!activePanel && activePanel !== "design" && !sheetLayout}
              >
                <div className="preview-toolbar no-print">
                  <div className="preview-toolbar-left">
                    <span className="eyebrow">Live preview</span>
                    <span className="template-label">
                      Design:{" "}
                      {
                        templates.find(
                          (t) => t.id === doc.presentation.template,
                        )!.name
                      }
                    </span>
                  </div>
                  {!showDesign && (
                  <label>
                    Page size{" "}
                    <select
                      aria-label="Page size"
                      disabled={busy}
                      value={doc.presentation.pageSize}
                      onChange={(e) =>
                        update((d) => {
                          d.presentation.pageSize = e.target.value as
                            | "A4"
                            | "Letter";
                        })
                      }
                    >
                      <option>A4</option>
                      <option>Letter</option>
                    </select>
                  </label>
                  )}
                </div>
                <div className="paper-stage">
                  <ResumePreview
                    doc={doc}
                    ref={preview}
                    onBlockClick={handlePreviewBlockClick}
                    showWatermark={!isSubscriber}
                  />
                </div>
                <p className="preview-footnote no-print">
                  {
                    templates.find((t) => t.id === doc.presentation.template)!
                      .name
                  }{" "}
                  · {doc.presentation.pageSize} · Selectable text
                  <br />
                  Print at 100% scale with browser headers and footers off.
                  Fonts and printer settings can affect output.
                </p>
              </section>
            </main>

            <footer className="app-footer no-print">
              <span>Your story, in your hands.</span>
              <span>
                Developed by Elfasys Solution
              </span>
            </footer>
            <style>{`@page { size: ${doc.presentation.pageSize}; margin: 0; }`}</style>
          </>
        )}
      </fieldset>
    </div>
  );
}
