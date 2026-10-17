"use client";

import { useState, useEffect } from "react";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { ResumeDocument } from "@/lib/document";
import {
  createSnapshot,
  getSavedSnapshots,
  saveSnapshotRecord,
  deleteSnapshotRecord,
  computeSnapshotDiff,
  restoreSnapshotAsVariant,
  type ResumeSnapshot,
} from "@/lib/snapshots";
import { Trash2, X } from "lucide-react";

export interface VersionHistoryModalProps {
  doc: ResumeDocument;
  busy: boolean;
  onRestore: (restored: ResumeDocument) => void;
  onForkVariant: (forked: ResumeDocument) => void;
  onClose: () => void;
}

export function VersionHistoryModal({
  doc,
  busy,
  onRestore,
  onForkVariant,
  onClose,
}: VersionHistoryModalProps) {
  useBodyScrollLock(true);
  const dialogRef = useModalFocus(onClose);
  const [snapshots, setSnapshots] = useState<ResumeSnapshot[]>([]);
  const [newSnapshotLabel, setNewSnapshotLabel] = useState("");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  useEffect(() => {
    setSnapshots(getSavedSnapshots(doc.id));
  }, [doc.id]);

  function handleCreateSnapshot() {
    const label = newSnapshotLabel.trim() || undefined;
    const snap = createSnapshot(doc, label);
    saveSnapshotRecord(snap);
    setSnapshots(getSavedSnapshots(doc.id));
    setNewSnapshotLabel("");
    setSelectedSnapshotId(snap.id);
  }

  function handleDelete(snapshotId: string) {
    deleteSnapshotRecord(doc.id, snapshotId);
    setSnapshots(getSavedSnapshots(doc.id));
    if (selectedSnapshotId === snapshotId) {
      setSelectedSnapshotId(null);
    }
  }

  function handleRestore(snap: ResumeSnapshot) {
    if (confirm(`Restore resume to "${snap.name}"? Your current changes will be replaced.`)) {
      onRestore(snap.document);
      onClose();
    }
  }

  function handleFork(snap: ResumeSnapshot) {
    const forked = restoreSnapshotAsVariant(snap);
    onForkVariant(forked);
    onClose();
  }

  return (
    <div
      className="modal-backdrop no-print"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Resume Version History"
    >
      <div className="modal-card tailor-modal" style={{ maxWidth: "780px" }}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Version history</p>
            <h2>Version History & Snapshots</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="tailor-content">
          <div className="snapshot-creator-bar" style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <input
              type="text"
              value={newSnapshotLabel}
              placeholder="Name this checkpoint (e.g. Before Google Tailoring, Draft v2)..."
              style={{ flex: 1, padding: "8px 12px", fontSize: "var(--text-sm)" }}
              onChange={(e) => setNewSnapshotLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateSnapshot();
                }
              }}
            />
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={handleCreateSnapshot}
            >
              + Save Checkpoint
            </button>
          </div>

          <div className="snapshots-timeline-container">
            {snapshots.length === 0 ? (
              <div className="empty-snapshots" style={{ textAlign: "center", padding: "30px 15px", color: "var(--muted)" }}>
                <p style={{ fontSize: "var(--text-md)", marginBottom: "6px" }}>No checkpoints saved for this resume yet.</p>
                <p style={{ fontSize: "var(--text-xs)" }}>
                  Save a checkpoint above to preserve milestones, track bullet rewrites, or fork targeted variants.
                </p>
              </div>
            ) : (
              <ul className="snapshots-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {snapshots.map((snap) => {
                  const isCurrent = snap.revision === doc.revision && JSON.stringify(snap.document) === JSON.stringify(doc);
                  const diff = computeSnapshotDiff(doc, snap.document);
                  const dateStr = new Date(snap.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <li
                      key={snap.id}
                      className="snapshot-item"
                      style={{
                        padding: "12px 16px",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                        backgroundColor: isCurrent ? "var(--color-brand-soft)" : "var(--color-surface)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <div className="snapshot-meta" style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                          <strong style={{ fontSize: "var(--text-sm)" }}>{snap.name}</strong>
                          {isCurrent && (
                            <span style={{ fontSize: "var(--text-xs)", background: "var(--color-brand)", color: "var(--color-on-brand)", padding: "1px 6px", borderRadius: "4px" }}>
                              Current Active
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--muted)" }}>
                          Saved {dateStr} · Revision {snap.revision}
                        </p>
                        {!isCurrent && (
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "4px" }}>
                            {diff.bulletCountDelta !== 0 && (
                              <span>{diff.bulletCountDelta > 0 ? `+${diff.bulletCountDelta}` : diff.bulletCountDelta} bullets · </span>
                            )}
                            {diff.sectionsModified.length > 0 && (
                              <span>Modified: {diff.sectionsModified.join(", ")}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="snapshot-actions" style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        {!isCurrent && (
                          <button
                            type="button"
                            className="primary"
                            style={{ fontSize: "var(--text-xs)", padding: "6px 10px" }}
                            onClick={() => handleRestore(snap)}
                            disabled={busy}
                          >
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          style={{ fontSize: "var(--text-xs)", padding: "6px 10px" }}
                          onClick={() => handleFork(snap)}
                          disabled={busy}
                        >
                          Fork Variant
                        </button>
                        <button
                          type="button"
                          style={{ fontSize: "var(--text-xs)", padding: "6px 8px", color: "var(--color-danger)" }}
                          onClick={() => handleDelete(snap.id)}
                          disabled={busy}
                          title="Delete snapshot"
                          aria-label="Delete snapshot"
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="button-row">
          <button type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
