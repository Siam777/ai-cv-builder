"use client";

import { useEffect, useRef, useState } from "react";
import {
  createDocument,
  duplicateDocument,
  parseBackup,
  documentSchema,
  uid,
  newEntry,
  type ResumeDocument,
} from "@/lib/document";
import { createRepository } from "@/lib/repository";
import { ResumePreview, type PreviewHandle } from "./resume-preview";
import { DesignPanel, type TemplateFilter } from "./design-panel";
import { templates } from "@/lib/presentation";
import { AccountPanel } from "./account-panel";
import { AIPanel, type AiPanelMode } from "./ai-panel";
import type { Proposal } from "@/lib/ai-proposals";
import type { LayoutBlock } from "@/lib/layout";
import {
  accountRequest,
  createCloudRepository,
  transferLocalResumes,
  CloudRequestError,
} from "@/lib/cloud-repository";
import { userCanExport, type AccountUser } from "@/lib/cloud-contract";
import { EditorHeader } from "./editor/EditorHeader";
import { DocumentToolbar } from "./editor/DocumentToolbar";
import { rememberWorkspaceFocus } from "@/lib/use-modal-focus";
import { EditorSidebar } from "./editor/EditorSidebar";
import { SectionEditor } from "./editor/SectionEditor";
import { ColdStartImporter } from "./editor/ColdStartImporter";
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
import { AtsReadinessPanel } from "./editor/AtsReadinessPanel";
import { KeyboardShortcutsModal } from "./editor/KeyboardShortcutsModal";
import { PricingModal } from "./billing/PricingModal";
import { AiCvGeneratorModal } from "./editor/AiCvGeneratorModal";
import { DemoResumesModal } from "./editor/DemoResumesModal";
import { DocumentLibrary } from "./editor/DocumentLibrary";
import { EditorStartGuide } from "./editor/EditorStartGuide";
import { documentsInCollection, startFromDesign } from "@/lib/document-library";
import {
  requestExport,
  downloadArtifact,
  printArtifact,
} from "@/lib/export-client";
import type { ExportRequest, ExportSource } from "@/lib/export-contract";
import type { PlanId } from "@/lib/billing-plans";
import type { StartingDesign } from "@/lib/public-catalog";
import type { FocusTarget, SaveState } from "./editor/types";
import type { ExportFormat } from "./editor/DocumentToolbar";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { watchSessionChanges } from "@/lib/session-events";
import { GuidedStartModal } from "./editor/GuidedStartModal";
import { PanelDialog } from "./editor/PanelDialog";
import { Palette, Sparkles } from "lucide-react";

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
  const [showDesign, setShowDesign] = useState(false);
  const [designFilter, setDesignFilter] = useState<TemplateFilter>("all");
  const [showAccount, setShowAccount] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [writingTarget, setWritingTarget] = useState<{
    mode: AiPanelMode;
    bulletId?: string;
    instruction?: string;
  }>({ mode: "bullet" });
  function openWriting(
    bulletId?: string,
    action: "improve" | "concise" | "metric" | "summary" = "improve",
  ) {
    setWritingTarget({
      mode:
        action === "metric"
          ? "interview"
          : action === "summary"
            ? "summary"
            : "bullet",
      bulletId,
      instruction:
        action === "concise"
          ? "Shorten this bullet without adding or strengthening facts."
          : undefined,
    });
    setShowAI(true);
  }
  const [showAiGen, setShowAiGen] = useState(false);
  const [showGuidedStart, setShowGuidedStart] = useState(false);
  const [showDemoGallery, setShowDemoGallery] = useState(false);
  const [showTailor, setShowTailor] = useState(false);
  const [reviewedVariantUndo, setReviewedVariantUndo] = useState<{
    variantId: string;
    revision: number;
    sourceId: string;
  } | null>(null);
  const [showAts, setShowAts] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>("free");
  const [cloudUser, setCloudUser] = useState<AccountUser | null>(null);
  const [sessionPaused, setSessionPaused] = useState(false);
  const paused = useRef(false);
  const preview = useRef<PreviewHandle>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [mobileTab, setMobileTab] = useState("editor");
  const [staged, setStaged] = useState<StagedImportData | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  const isModalActive = Boolean(
    showDesign ||
    showAccount ||
    showAI ||
    showAiGen ||
    showGuidedStart ||
    showDemoGallery ||
    showTailor ||
    showAts ||
    showPricing ||
    showCoverLetter ||
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

  function select(next: ResumeDocument) {
    setShowLibrary(false);
    setShowAI(false);
    clearTimeout(timer.current);
    current.current = next;
    setDoc(next);
    history.current = [];
    setUndoCount(0);
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
            setShowCoverLetter(false);
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
    if (!sessionUser) {
      setIsSubscriber(false);
      setCurrentPlanId("free");
      return;
    }
    let active = true;
    fetch("/api/billing/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.subscription?.planId && data.subscription.planId !== "free") {
          setIsSubscriber(true);
          setCurrentPlanId(data.subscription.planId || "job_hunter_monthly");
        } else {
          setIsSubscriber(false);
          setCurrentPlanId("free");
        }
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
    }
    current.current = next;
    change.current++;
    setDoc(next);
    setUndoCount(history.current.length);
    setStatus("Unsaved changes");
    clearTimeout(timer.current);
    if (!paused.current)
      timer.current = setTimeout(() => {
        void flush().catch(() => {});
      }, 450);
  }

  function handleUndo() {
    const old = history.current.pop();
    if (old) update((d) => Object.assign(d, old), false);
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
        if (showTailor) {
          e.preventDefault();
          setShowTailor(false);
          return;
        }
        if (showCoverLetter) {
          e.preventDefault();
          setShowCoverLetter(false);
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
        if (showAI) {
          e.preventDefault();
          setShowAI(false);
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

      // Global Undo: Ctrl+Z or Cmd+Z when NOT typing inside an editable field
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        const isAnyModalOpen =
          showAccount ||
          showAI ||
          showTailor ||
          showAts ||
          showPricing ||
          showCoverLetter ||
          showHistory ||
          showAddSection ||
          showShortcuts ||
          showDesign ||
          showAiGen ||
          showGuidedStart ||
          showDemoGallery ||
          !!staged;

        if (!isEditable) {
          e.preventDefault();
          if (!isAnyModalOpen) handleUndo();
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
    showTailor,
    showCoverLetter,
    showHistory,
    showAddSection,
    showAccount,
    showAI,
    showGuidedStart,
    isModalActive,
    showDesign,
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
    setShowCoverLetter(false);
    setShowAts(false);
    setShowHistory(false);
    setShowDesign(false);
    setDesignFilter("all");
    setShowTailor(false);
    setReviewedVariantUndo(null);
    setStaged(null);
    history.current = [];
    setUndoCount(0);
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

  async function acceptAI(proposal: Proposal) {
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
        body: JSON.stringify({ decision: "accept", confirmed: true }),
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
        setShowCoverLetter(false);
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
        setShowCoverLetter(false);
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
        setShowCoverLetter(false);
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
        doc={doc}
        libraryMode={showLibrary}
        cloudUser={cloudUser}
        sessionUser={sessionUser}
        status={status}
        busy={busy}
        ready={ready}
        showAccount={showAccount}
        showAI={showAI}
        onOpenAccount={() => setShowAccount(true)}
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
            setShowLibrary(true);
          });
        }}
        onOpenAts={() => setShowAts(true)}
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
            beforeNavigate={flush}
            pendingAction={pendingExport ? "Continue export" : undefined}
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
              }
            }}
            onLocal={() => switchWorkspace(null)}
            onCloud={(user) => switchWorkspace(user)}
            onSignedOut={async (deleted) => {
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
            }}
            onClose={() => {
              setShowAccount(false);
              setPendingExport(null);
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

      {showAI && doc && (
        <AIPanel
          key={`${cloudUser?.id ?? "local"}:${doc.id}`}
          doc={doc}
          owner={cloudUser?.id ?? null}
          prepare={prepareAI}
          accept={acceptAI}
          onClose={() => setShowAI(false)}
          onUpdateDocument={update}
          initialMode={writingTarget.mode}
          initialBulletId={writingTarget.bulletId}
          initialInstruction={writingTarget.instruction}
          onOpenAccount={() => {
            setShowAI(false);
            setShowAccount(true);
          }}
          onEditSection={(id) => {
            setShowAI(false);
            setMobileTab("editor");
            setSectionId(id);
          }}
        />
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

      {showTailor && doc && (
        <JobTailorModal
          key={`${cloudUser?.id ?? "device"}:${doc.id}`}
          owner={cloudUser?.id ?? null}
          prepareHistory={prepareAI}
          acceptCoaching={acceptAI}
          doc={{
            ...doc,
            revision: revisions.current.get(doc.id) ?? doc.revision,
          }}
          busy={busy}
          onApplyTailoredVariant={async (tailored, sourceSnapshot) => {
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
              setShowTailor(false);
              setNotice(
                "Reviewed ordering saved in an independent variant. Your original CV is kept.",
              );
              succeeded = true;
            });
            return succeeded;
          }}
          onClose={() => setShowTailor(false)}
        />
      )}

      {showAts && doc && (
        <AtsReadinessPanel
          doc={doc}
          onNavigateToIssue={(issue) => {
            if (issue.sectionId) setSectionId(issue.sectionId);
            if (issue.sectionId || issue.bulletId || issue.entryId) {
              setFocusTarget({
                sectionId: issue.sectionId || "contact",
                entryId: issue.entryId,
                bulletId: issue.bulletId,
              });
            }
            setShowAts(false);
          }}
          onClose={() => setShowAts(false)}
        />
      )}

      {showPricing && (
        <PricingModal
          cloudUser={cloudUser}
          currentPlanId={currentPlanId}
          onOpenAccount={() => {
            setShowPricing(false);
            setShowAccount(true);
          }}
          onClose={() => setShowPricing(false)}
        />
      )}

      {showCoverLetter && doc && (
        <CoverLetterModal
          doc={doc}
          busy={busy}
          onClose={() => setShowCoverLetter(false)}
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

      {showDesign && doc && (
        <DesignPanel
          doc={doc}
          disabled={busy}
          onChange={(settings) =>
            update((d) => {
              Object.assign(d.presentation, settings);
            })
          }
          initialFilter={designFilter}
          onClose={() => {
            setShowDesign(false);
            setDesignFilter("all");
          }}
          onOpenDemoGallery={() => setShowDemoGallery(true)}
        />
      )}

      {staged && (
        <ImportReviewModal
          staged={staged}
          hasActiveDoc={!!doc}
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
            doc
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
          showAI ||
          showTailor ||
          showAts ||
          showPricing ||
          showCoverLetter ||
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
          showAI ||
          showTailor ||
          showAts ||
          showPricing ||
          showCoverLetter ||
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
        {showLibrary ? (
          <>
            {selectedStart && (
              <section
                className="starting-design no-print"
                aria-label="Selected starting design"
              >
                <div>
                  <strong>Start with {selectedStart.label}</strong>
                  <p>
                    Create my resume will use this design with empty personal
                    details. Existing CVs stay unchanged.
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
              onNew={createSelectedResume}
              onImport={() => {
                setShowLibrary(false);
                current.current = null;
                setDoc(null);
              }}
              onExamples={() => setShowDemoGallery(true)}
              onAccount={() => setShowAccount(true)}
              onGuidedStart={() => setShowGuidedStart(true)}
            />
          </>
        ) : !doc ? (
          <main id="workspace-main" tabIndex={-1} className="welcome no-print">
            <Sparkles className="welcome-symbol" size={40} aria-hidden />
            <p className="eyebrow">A fresh start</p>
            <h2>
              Your experience deserves
              <br />a thoughtful introduction.
            </h2>
            <p>
              Start with a blank page, upload your current resume, or explore a
              fictional example.
              <br />
              {cloudUser
                ? "Your resumes are saved in your account."
                : "Your resumes stay in this browser, on this device."}
            </p>
            <div className="button-row">
              <button
                className="primary"
                disabled={!ready || busy || status === "Save failed"}
                onClick={() => {
                  void action(() => addDocument(createDocument()));
                }}
              >
                Create my resume <span>↗</span>
              </button>
              <button
                disabled={!ready || busy || status === "Save failed"}
                onClick={() => {
                  setShowDemoGallery(true);
                }}
              >
                Explore an example
              </button>
              <button
                disabled={!ready || busy}
                onClick={() => fileInput.current?.click()}
              >
                Restore a backup
              </button>
            </div>

            <ColdStartImporter
              disabled={!ready || busy}
              onStaged={(data) => setStaged(data)}
              onError={(err) => setError(err)}
              onOpenAiGenerator={() => setShowAiGen(true)}
              onOpenDemoGallery={() => setShowDemoGallery(true)}
            />

            <p className="privacy-note">
              Edit on this device without an account. Sign in to download or
              export.
              <br />
              Clearing browser data removes local resumes. Server export
              processing requires your confirmation.
            </p>
          </main>
        ) : (
          <>
            <div className="document-context no-print">
              <span className="library-kind">
                {doc.provenance.purpose === "personal"
                  ? "Personal CV"
                  : doc.provenance.purpose === "practice"
                    ? "Practice / fictional content"
                    : "Older draft · needs review"}
              </span>
              {doc.provenance.purpose !== "personal" && (
                <button
                  onClick={() => {
                    void classifyDocument(doc, "personal");
                  }}
                >
                  Review and mark as my CV
                </button>
              )}
            </div>
            <DocumentToolbar
              doc={doc}
              documents={documentsInCollection(
                documents,
                doc.provenance.purpose,
              )}
              busy={busy}
              undoCount={undoCount}
              showDesign={showDesign}
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
              onNew={() => {
                void action(() => addDocument(createDocument()));
              }}
              onDuplicate={() => {
                void action(() =>
                  addDocument(duplicateDocument(current.current!)),
                );
              }}
              onImportClick={() => fileInput.current?.click()}
              onUndo={handleUndo}
              onToggleDesign={() => setShowDesign((val) => !val)}
              onOpenAI={() => openWriting()}
              onOpenAiGenerator={() => setShowAiGen(true)}
              onOpenDemoGallery={() => setShowDemoGallery(true)}
              onOpenAts={() => setShowAts(true)}
              onOpenTailor={() => setShowTailor(true)}
              onOpenCoverLetter={() => setShowCoverLetter(true)}
              onOpenHistory={() => setShowHistory(true)}
              onPrint={() => checkedExport("print")}
              onExport={checkedExport}
            />

            <nav
              className="editor-taskbar no-print"
              aria-label="Help with this CV"
            >
              <button
                disabled={busy}
                onClick={() => {
                  setSectionId("contact");
                  setMobileTab("editor");
                  setFocusTarget({ sectionId: "contact", field: "photo" });
                }}
              >
                <strong>Add or change photo</strong>
                <span>In Personal details</span>
              </button>
              <button disabled={busy} onClick={() => openWriting()}>
                <strong>Writing help</strong>
                <span>Bullets, summary, results and skills</span>
              </button>
              <button disabled={busy} onClick={() => setShowAts(true)}>
                <strong>Check my CV</strong>
                <span>Find issues and jump to a fix</span>
              </button>
              <button disabled={busy} onClick={() => setShowTailor(true)}>
                <strong>Compare with a job</strong>
                <span>See matches and missing evidence</span>
              </button>
            </nav>
            <EditorStartGuide
              key={doc.id}
              doc={doc}
              busy={busy}
              onSection={(id) => {
                setMobileTab("editor");
                setSectionId(id);
                setFocusTarget({
                  sectionId: id,
                  field: id === "contact" ? "name" : undefined,
                });
              }}
              onReview={() => setShowAts(true)}
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
              <button disabled={busy} onClick={() => setShowAts(true)}>
                Review resume
              </button>
              <span className="mobile-save-feedback">
                {cloudUser && status === "Saved in this browser"
                  ? "Saved to your account"
                  : status}
              </span>
            </div>

            <main
              id="workspace-main"
              tabIndex={-1}
              className={`editor-layout show-${mobileTab}`}
            >
              <EditorSidebar
                doc={doc}
                sectionId={sectionId}
                cloudUser={cloudUser}
                onSelectSection={(id) => setSectionId(id)}
                onAddSection={() => setShowAddSection(true)}
              />

              <SectionEditor
                doc={doc}
                sectionId={sectionId}
                busy={busy}
                cloudUser={cloudUser}
                focusTarget={focusTarget}
                onWritingAction={openWriting}
                onOpenPhotoDesigns={() => {
                  setDesignFilter("photo");
                  setShowDesign(true);
                }}
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
                onDeleteResume={() => deleteSavedDocument(doc)}
              />

              <section
                id="resume-preview-panel"
                className="preview-panel"
                aria-label="Live preview"
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
                    <button
                      type="button"
                      className="preview-change-style-btn"
                      onClick={() => setShowDesign(true)}
                      title="Change template, colors, and typography"
                    >
                      <Palette size={16} aria-hidden /> Change style
                    </button>
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
                              "A4" | "Letter";
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
