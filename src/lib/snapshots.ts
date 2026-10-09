import {
  type ResumeDocument,
  documentSchema,
  duplicateDocument,
  uid,
} from "./document";

export interface ResumeSnapshot {
  id: string;
  documentId: string;
  name: string;
  revision: number;
  createdAt: string;
  document: ResumeDocument;
}

export interface SnapshotDiff {
  nameChanged: boolean;
  sectionsAdded: string[];
  sectionsRemoved: string[];
  sectionsModified: string[];
  bulletCountDelta: number;
}

const STORAGE_PREFIX = "cv_snapshots_";

/**
 * Creates a new immutable checkpoint snapshot from the active resume document.
 */
export function createSnapshot(
  doc: ResumeDocument,
  label?: string,
): ResumeSnapshot {
  const now = new Date();
  const defaultLabel = `Checkpoint (Rev ${doc.revision}) · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return {
    id: uid(),
    documentId: doc.id,
    name: label?.trim() || defaultLabel,
    revision: doc.revision,
    createdAt: now.toISOString(),
    document: structuredClone(doc),
  };
}

/**
 * Computes a human-readable structural diff between two versions of a resume.
 */
export function computeSnapshotDiff(
  current: ResumeDocument,
  snapshot: ResumeDocument,
): SnapshotDiff {
  const currentSections = new Map(current.sections.map((s) => [s.id, s]));
  const snapshotSections = new Map(snapshot.sections.map((s) => [s.id, s]));

  const sectionsAdded: string[] = [];
  const sectionsRemoved: string[] = [];
  const sectionsModified: string[] = [];

  for (const [id, s] of currentSections) {
    if (!snapshotSections.has(id)) {
      sectionsAdded.push(s.label || s.type);
    } else {
      const snapS = snapshotSections.get(id)!;
      if (JSON.stringify(s) !== JSON.stringify(snapS)) {
        sectionsModified.push(s.label || s.type);
      }
    }
  }

  for (const [id, s] of snapshotSections) {
    if (!currentSections.has(id)) {
      sectionsRemoved.push(s.label || s.type);
    }
  }

  const currentBulletsCount = current.sections.reduce(
    (acc, s) => acc + s.entries.reduce((ea, e) => ea + e.bullets.length, 0),
    0,
  );
  const snapshotBulletsCount = snapshot.sections.reduce(
    (acc, s) => acc + s.entries.reduce((ea, e) => ea + e.bullets.length, 0),
    0,
  );

  return {
    nameChanged: current.name !== snapshot.name,
    sectionsAdded,
    sectionsRemoved,
    sectionsModified,
    bulletCountDelta: currentBulletsCount - snapshotBulletsCount,
  };
}

/**
 * Lists saved snapshots for a document from local storage, sorted newest first.
 */
export function getSavedSnapshots(documentId: string): ResumeSnapshot[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${documentId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        try {
          const doc = documentSchema.parse(item.document);
          return {
            id: String(item.id),
            documentId: String(item.documentId),
            name: String(item.name),
            revision: Number(item.revision),
            createdAt: String(item.createdAt),
            document: doc,
          };
        } catch {
          return null;
        }
      })
      .filter((s): s is ResumeSnapshot => s !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

/**
 * Persists a new snapshot into storage, maintaining a maximum capacity of 30 snapshots per document.
 */
export function saveSnapshotRecord(snapshot: ResumeSnapshot): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const existing = getSavedSnapshots(snapshot.documentId);
    const updated = [snapshot, ...existing.filter((s) => s.id !== snapshot.id)].slice(0, 30);
    localStorage.setItem(
      `${STORAGE_PREFIX}${snapshot.documentId}`,
      JSON.stringify(updated),
    );
  } catch {
    // Fail gracefully if quota exceeded
  }
}

/**
 * Deletes a snapshot by ID from storage.
 */
export function deleteSnapshotRecord(documentId: string, snapshotId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const existing = getSavedSnapshots(documentId);
    const updated = existing.filter((s) => s.id !== snapshotId);
    localStorage.setItem(
      `${STORAGE_PREFIX}${documentId}`,
      JSON.stringify(updated),
    );
  } catch {
    // Ignore error
  }
}

/**
 * Restores a snapshot as a new independent duplicate variant.
 */
export function restoreSnapshotAsVariant(
  snapshot: ResumeSnapshot,
  variantName?: string,
): ResumeDocument {
  const name =
    variantName || `${snapshot.document.name} (Restored from ${new Date(snapshot.createdAt).toLocaleDateString()})`;
  return duplicateDocument(snapshot.document, name);
}
