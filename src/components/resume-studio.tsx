"use client";

import { useEffect, useRef, useState } from "react";
import {
  createDocument,
  duplicateDocument,
  parseBackup,
  toPlainText,
  documentSchema,
  uid,
  newEntry,
  type ResumeDocument,
} from "@/lib/document";
import { createRepository } from "@/lib/repository";
import { ResumePreview, type PreviewHandle } from "./resume-preview";
import { DesignPanel } from "./design-panel";
import { templates } from "@/lib/presentation";
import { AccountPanel } from "./account-panel";
import { AIPanel } from "./ai-panel";
import type { Proposal } from "@/lib/ai-proposals";
import type { LayoutBlock } from "@/lib/layout";
import {
  accountRequest,
  createCloudRepository,
  transferLocalResumes,
} from "@/lib/cloud-repository";
import type { AccountUser } from "@/lib/cloud-contract";
import { EditorHeader } from "./editor/EditorHeader";
import { DocumentToolbar } from "./editor/DocumentToolbar";
import { EditorSidebar } from "./editor/EditorSidebar";
import { SectionEditor } from "./editor/SectionEditor";
import {
  ColdStartImporter,
} from "./editor/ColdStartImporter";
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
import { CoverLetterModal } from "./vault/CoverLetterModal";
import { VersionHistoryModal } from "./editor/VersionHistoryModal";
import { AddSectionModal } from "./editor/AddSectionModal";
import { AtsReadinessPanel } from "./editor/AtsReadinessPanel";
import { KeyboardShortcutsModal } from "./editor/KeyboardShortcutsModal";
import { PricingModal } from "./billing/PricingModal";
import { AiCvGeneratorModal } from "./editor/AiCvGeneratorModal";
import { DemoResumesModal } from "./editor/DemoResumesModal";
import type { PlanId } from "@/lib/billing-plans";
import type { FocusTarget, SaveState } from "./editor/types";
import type { ExportFormat } from "./editor/DocumentToolbar";
import { exportToMarkdown } from "@/lib/exporters/markdown-exporter";
import { exportToStandaloneHtml } from "@/lib/exporters/html-exporter";
import { exportToDocx } from "@/lib/exporters/docx-exporter";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

function download(content: string | Uint8Array | BlobPart, name: string, type: string) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content as any], { type });
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

export function ResumeStudio() {
  const [doc, setDoc] = useState<ResumeDocument | null>(null);
  const [documents, setDocuments] = useState<ResumeDocument[]>([]);
  const [sectionId, setSectionId] = useState("contact");
  const [status, setStatus] = useState<SaveState>("Loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDesign, setShowDesign] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAiGen, setShowAiGen] = useState(false);
  const [showDemoGallery, setShowDemoGallery] = useState(false);
  const [showTailor, setShowTailor] = useState(false);
  const [showAts, setShowAts] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<PlanId>("free");
  const [cloudUser, setCloudUser] = useState<AccountUser | null>(null);
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
    showDemoGallery ||
    showTailor ||
    showAts ||
    showPricing ||
    showCoverLetter ||
    showHistory ||
    showAddSection ||
    showShortcuts ||
    staged
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
    setStatus("Saved on this device");
  }

  useEffect(() => {
    let active = true;
    repository.current = createRepository();
    repository.current
      .list()
      .then((list) => {
        if (!active) return;
        list.forEach((d) => revisions.current.set(d.id, d.revision));
        setDocuments(list);
        if (list.length) select(list[0]);
        else setStatus("Saved on this device");
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
    if (typeof window !== "undefined" && window.location.search.includes("billing=success")) {
      setNotice(
        "🎉 Congratulations! Your Job Hunter Pass is active. Watermark-free exports and AI Job Tailoring are unlocked.",
      );
      window.history.replaceState({}, "", window.location.pathname);
      setIsSubscriber(true);
    }
  }, []);

  useEffect(() => {
    if (!cloudUser) {
      setIsSubscriber(false);
      setCurrentPlanId("free");
      return;
    }
    let active = true;
    fetch("/api/billing/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.subscription?.isSubscriber) {
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
  }, [cloudUser]);

  async function flush() {
    clearTimeout(timer.current);
    const task = chain.current
      .catch(() => {})
      .then(async () => {
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
              ? "Saved on this device"
              : "Unsaved changes",
          );
        } catch (e) {
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
          !!staged;

        if (!isEditable && !isAnyModalOpen) {
          e.preventDefault();
          handleUndo();
          return;
        }
      }

      // '?' (Shift + /) toggles the Keyboard Shortcuts Modal when NOT typing in an editable field
      if (e.key === "?" && !isEditable) {
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

  async function switchWorkspace(user: AccountUser | null, save = true) {
    if (save) await flush();
    const next = user ? createCloudRepository(user.id) : createRepository();
    const list = await next.list();
    clearTimeout(timer.current);
    repository.current = next;
    setCloudUser(user);
    setShowAI(false);
    revisions.current = new Map(list.map((d) => [d.id, d.revision]));
    current.current = null;
    setDoc(null);
    history.current = [];
    setUndoCount(0);
    change.current = 0;
    savedChange.current = 0;
    setStaged(null);
    setDocuments(list);
    setError("");
    setStatus("Saved on this device");
    if (list.length) select(list[0]);
  }

  async function verifyExport() {
    if (cloudUser && current.current) {
      const saved = await createCloudRepository(cloudUser.id).get(
        current.current.id,
      );
      if (saved.revision !== revisions.current.get(saved.id))
        throw new Error(
          "This resume changed elsewhere. Download a recovery backup before reloading.",
        );
    }
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
    setStatus("Saved on this device");
  }

  function checkedExport(format: ExportFormat) {
    void action(async () => {
      await verifyExport();
      await exportFile(format);
    });
  }

  async function exportFile(format: ExportFormat) {
    if (!current.current) return;
    const latest = {
      ...current.current,
      revision: revisions.current.get(current.current.id) ?? 0,
    };
    const cleanName =
      latest.name
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 100) || "resume";

    const watermark = !isSubscriber;

    if (format === "json") {
      download(
        JSON.stringify(latest, null, 2),
        `${cleanName}.json`,
        "application/json",
      );
      setNotice("Resume JSON backup exported.");
    } else if (format === "txt") {
      download(
        toPlainText(latest),
        `${cleanName}.txt`,
        "text/plain;charset=utf-8",
      );
      setNotice("Plain-text resume exported.");
    } else if (format === "md") {
      download(
        exportToMarkdown(latest),
        `${cleanName}.md`,
        "text/markdown;charset=utf-8",
      );
      setNotice("Markdown resume exported.");
    } else if (format === "html") {
      download(
        exportToStandaloneHtml(latest, { showWatermark: watermark }),
        `${cleanName}.html`,
        "text/html;charset=utf-8",
      );
      setNotice("Standalone HTML resume exported.");
    } else if (format === "docx") {
      const docxBytes = exportToDocx(latest, { showWatermark: watermark });
      download(
        docxBytes,
        `${cleanName}.docx`,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      setNotice("Word document (.docx) exported.");
    } else if (format === "pdf") {
      try {
        setStatus("Saving…");
        setNotice("Generating PDF…");
        const res = await fetch("/api/resumes/export-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document: latest }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `PDF export failed with status ${res.status}`);
        }
        const blob = await res.blob();
        download(blob, `${cleanName}.pdf`, "application/pdf");
        setStatus("Saved on this device");
        setNotice("PDF downloaded successfully.");
      } catch (err) {
        console.error("Server PDF export failed, falling back to print dialog:", err);
        setError("Direct PDF download failed. Opening print dialog to save as PDF…");
        await document.fonts.ready;
        await preview.current?.prepare();
        window.print();
      }
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
    <div className="studio">
      <EditorHeader
        doc={doc}
        cloudUser={cloudUser}
        status={status}
        busy={busy}
        ready={ready}
        showAccount={showAccount}
        showAI={showAI}
        onOpenAccount={() => setShowAccount(true)}
        onOpenAts={() => setShowAts(true)}
        onOpenPricing={() => setShowPricing(true)}
        onOpenShortcuts={() => setShowShortcuts(true)}
        isSubscriber={isSubscriber}
      />

      {showAccount && (
        <AccountPanel
          cloudOwner={cloudUser?.id ?? null}
          beforeChange={flush}
          onLocal={() => switchWorkspace(null)}
          onCloud={(user) => switchWorkspace(user)}
          onSignedOut={() => switchWorkspace(null, false)}
          onClose={() => setShowAccount(false)}
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
            const data = await accountRequest("/api/account/export", {}, owner);
            download(
              JSON.stringify(data, null, 2),
              "cv-builder-account.json",
              "application/json",
            );
          }}
        />
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

      {showDemoGallery && (
        <DemoResumesModal
          isOpen={showDemoGallery}
          onClose={() => setShowDemoGallery(false)}
          onSelectDemo={(demoDoc) => {
            void action(async () => {
              await addDocument(demoDoc);
              setShowDemoGallery(false);
            });
          }}
        />
      )}

      {showTailor && doc && (
        <JobTailorModal
          doc={doc}
          busy={busy}
          onApplyTailoredVariant={(tailored) => {
            void action(async () => {
              await addDocument(tailored);
              setShowTailor(false);
            });
          }}
          onClose={() => setShowTailor(false)}
        />
      )}

      {showAts && doc && (
        <AtsReadinessPanel
          doc={doc}
          onAddSkill={(skill) => {
            update((draft) => {
              let skillSec = draft.sections.find((s) => s.type === "skills");
              if (!skillSec) {
                skillSec = {
                  id: uid(),
                  type: "skills",
                  label: "Skills",
                  visible: true,
                  entries: [],
                };
                draft.sections.push(skillSec);
              }
              if (skillSec.entries.length === 0) {
                skillSec.entries.push({
                  ...newEntry(),
                  title: "Core Competencies",
                  bullets: [{ id: uid(), text: skill }],
                });
              } else {
                const alreadyExists = skillSec.entries.some((e) =>
                  e.bullets.some((b) => b.text.toLowerCase().trim() === skill.toLowerCase().trim()) ||
                  e.description.toLowerCase().includes(skill.toLowerCase().trim()),
                );
                if (!alreadyExists) {
                  skillSec.entries[0].bullets.push({
                    id: uid(),
                    text: skill,
                  });
                }
              }
            });
          }}
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
          onDownloadFile={(content, filename, mime) => {
            download(content, filename, mime);
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
          onClose={() => setShowDesign(false)}
          onOpenDemoGallery={() => setShowDemoGallery(true)}
        />
      )}

      <fieldset
        className="workspace-body"
        style={{ display: showAccount ? "none" : undefined }}
        disabled={showAccount || showAI || showTailor || showAts || showPricing || showCoverLetter || showHistory || showAddSection || showShortcuts}
        inert={showAccount || showAI || showTailor || showAts || showPricing || showCoverLetter || showHistory || showAddSection || showShortcuts}
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
              <button onClick={() => exportFile("json")}>
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
        {!doc ? (
          <main className="welcome no-print">
            <span className="welcome-symbol">✦</span>
            <p className="eyebrow">A FRESH START</p>
            <h2>
              Your experience deserves
              <br />a thoughtful introduction.
            </h2>
            <p>
              Start with a blank page, upload your current resume, or explore a fictional example.
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
                  void action(() => addDocument(createDocument(true)));
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
              No account required. No resume data is sent to an AI provider.
              <br />
              Export a JSON backup regularly; clearing browser data removes
              local resumes.
            </p>
          </main>
        ) : (
          <>
            <DocumentToolbar
              doc={doc}
              documents={documents}
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
              onOpenAI={() => setShowAI(true)}
              onOpenAiGenerator={() => setShowAiGen(true)}
              onOpenDemoGallery={() => setShowDemoGallery(true)}
              onOpenAts={() => setShowAts(true)}
              onOpenTailor={() => setShowTailor(true)}
              onOpenCoverLetter={() => setShowCoverLetter(true)}
              onOpenHistory={() => setShowHistory(true)}
              onPrint={() => {
                void action(async () => {
                  await verifyExport();
                  await document.fonts.ready;
                  await preview.current?.prepare();
                  window.print();
                });
              }}
              onExport={checkedExport}
            />

            <div className="mobile-tabs no-print">
              <button
                aria-pressed={mobileTab === "editor"}
                onClick={() => setMobileTab("editor")}
              >
                Edit details
              </button>
              <button
                aria-pressed={mobileTab === "preview"}
                onClick={() => setMobileTab("preview")}
              >
                Preview resume
              </button>
            </div>

            <main className={`editor-layout show-${mobileTab}`}>
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
                onDeleteResume={() => {
                  if (
                    window.confirm(
                      `Delete “${doc.name}” from ${cloudUser ? "your account" : "this browser"}? Export a backup first if you need to keep it.`,
                    )
                  )
                    void action(async () => {
                      await repository.current!.remove(
                        doc.id,
                        revisions.current.get(doc.id)!,
                      );
                      const list = await repository.current!.list();
                      setDocuments(list);
                      if (list.length) select(list[0]);
                      else {
                        current.current = null;
                        setDoc(null);
                      }
                    });
                }}
              />

              <section className="preview-panel" aria-label="Live preview">
                <div className="preview-toolbar no-print">
                  <div className="preview-toolbar-left">
                    <span className="eyebrow">LIVE PREVIEW</span>
                    <span className="template-label">
                      {
                        templates.find(
                          (t) => t.id === doc.presentation.template,
                        )!.name
                      }{" "}
                      <span>✓</span>
                    </span>
                    <button
                      type="button"
                      className="preview-change-style-btn"
                      onClick={() => setShowDesign(true)}
                      title="Change template, colors, and typography"
                    >
                      🎨 Change style
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
              <span>YOUR STORY, IN YOUR HANDS.</span>
              <span>
                {cloudUser ? "Account editor" : "Local editor"} · AI suggestions
                require your review
              </span>
            </footer>
            <style>{`@page { size: ${doc.presentation.pageSize}; margin: 0; }`}</style>
          </>
        )}
      </fieldset>
    </div>
  );
}
