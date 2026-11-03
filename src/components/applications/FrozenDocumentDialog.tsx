"use client";
import { useEffect, useState } from "react";
import { ResumePreview } from "@/components/resume-preview";
import type { FrozenDocument } from "@/lib/applications";
import { trackerApi } from "@/lib/applications-client";
import { downloadArtifact, requestExport } from "@/lib/export-client";
import { TrackerDialog } from "./TrackerDialog";

/** A frozen CV or letter, exactly as it was kept, with "Download again". */
export function FrozenDocumentDialog({
  owner,
  applicationId,
  documentId,
  onClose,
}: {
  owner: string;
  applicationId: string;
  documentId: string;
  onClose: () => void;
}) {
  const [frozen, setFrozen] = useState<FrozenDocument | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let active = true;
    trackerApi(owner)
      .document(applicationId, documentId)
      .then((value) => active && setFrozen(value))
      .catch((reason: Error) => active && setError(reason.message));
    return () => {
      active = false;
    };
  }, [owner, applicationId, documentId]);
  async function download() {
    if (!frozen) return;
    setWorking(true);
    setError("");
    try {
      const source = { storage: "frozen" as const, applicationId, documentId };
      const artifact =
        frozen.content.kind === "cv"
          ? await requestExport(
              { kind: "resume", source, format: "pdf" },
              owner,
            )
          : await requestExport(
              {
                kind: "letter",
                source,
                format: "txt",
                text: frozen.content.text,
                name: frozen.content.name,
              },
              owner,
            );
      downloadArtifact(artifact.blob, artifact.filename);
      setStatus("Download started.");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setWorking(false);
    }
  }
  const title = frozen ? `Frozen copy: ${frozen.name}` : "Frozen copy";
  return (
    <TrackerDialog
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            className="primary"
            onClick={() => void download()}
            disabled={!frozen || working}
          >
            {working
              ? "Preparing…"
              : frozen?.kind === "cover_letter"
                ? "Download again (.txt)"
                : "Download again (.pdf)"}
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status">
        {status}
      </p>
      {!frozen && !error && <p role="status">Loading the frozen copy…</p>}
      {frozen && (
        <>
          <p className="tracker-muted">
            Kept on {new Date(frozen.createdAt).toLocaleString()}
            {frozen.exportSnapshotId ? " from the file you exported" : ""}
            {frozen.sourceRevision !== null
              ? ` (CV version ${frozen.sourceRevision})`
              : ""}
            . The copy you sent is kept as it was. If you change your CV later,
            this copy does not change. A new download is rendered from this copy
            and can differ slightly if a design changes later.
          </p>
          {frozen.photoOmitted && (
            <p className="tracker-muted">
              {frozen.kind === "cv"
                ? "A photo was included. It was left out of this copy to keep it under 512 KB."
                : "Letters are kept without the photo."}
            </p>
          )}
          {frozen.content.kind === "cv" ? (
            <div
              className="tracker-frozen-preview"
              aria-label="Frozen CV"
              role="region"
            >
              <ResumePreview doc={frozen.content.document} />
            </div>
          ) : (
            <div
              className="tracker-frozen-letter"
              aria-label="Frozen cover letter"
              role="region"
            >
              {frozen.content.text}
            </div>
          )}
        </>
      )}
    </TrackerDialog>
  );
}
