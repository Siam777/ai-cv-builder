"use client";
import { useEffect, useRef, useState } from "react";
import type { ResumeDocument } from "@/lib/document";
import type { FileDiagnosticReport } from "@/lib/file-diagnostics";

export function FileDiagnosticResults({
  report,
  stale = false,
}: {
  report: FileDiagnosticReport;
  stale?: boolean;
}) {
  return (
    <section className="file-diagnostics" aria-label="File diagnostic results">
      <h3>Actual file observations</h3>
      {stale && (
        <p role="status" className="alert">
          The current CV changed after this comparison. Run the check again;
          these results describe the earlier snapshot.
        </p>
      )}
      <p>
        {report.file.name} · {report.file.format.toUpperCase()} ·{" "}
        {report.pageCount === null
          ? "Physical pages not determined"
          : `${report.pageCount} pages`}
      </p>
      <details>
        <summary>File and analysis record</summary>
        <dl>
          <dt>SHA-256 of uploaded bytes</dt>
          <dd>
            <code>{report.file.sha256}</code>
          </dd>
          <dt>Parser</dt>
          <dd>
            {report.parser.name} · {report.parser.version}
          </dd>
          <dt>Diagnostic rules</dt>
          <dd>{report.version}</dd>
          <dt>Checked</dt>
          <dd>{new Date(report.analyzedAt).toLocaleString()}</dd>
          {report.comparison && (
            <>
              <dt>Compared CV revision</dt>
              <dd>{report.comparison.revision}</dd>
              <dt>Source content hash</dt>
              <dd>
                <code>{report.comparison.contentHash}</code>
              </dd>
            </>
          )}
        </dl>
      </details>
      <ul className="ats-issue-list">
        {report.checks.map((check) => (
          <li
            key={check.id}
            className={`ats-issue-card ${check.status === "issue" ? "warning" : "info"}`}
          >
            <strong>
              {check.label} ·{" "}
              {check.status === "not_checked"
                ? "Not checked"
                : check.status === "issue"
                  ? "Review needed"
                  : "Observed"}
            </strong>
            <p>{check.detail}</p>
          </li>
        ))}
      </ul>
      {!!report.comparison?.findings.length && (
        <details open>
          <summary>Source blocks to review</summary>
          <ul>
            {report.comparison.findings.map((finding, index) => (
              <li key={`${finding.id}-${index}`}>
                <strong>
                  {finding.status === "missing"
                    ? "Not found"
                    : "Out of sequence"}
                </strong>
                : {finding.text}
              </li>
            ))}
          </ul>
          <p>
            Showing up to 30 findings. Counts above include every compared
            block.
          </p>
        </details>
      )}
      {!!report.links.length && (
        <details>
          <summary>Extracted link targets</summary>
          <ul>
            {report.links.map((link, index) => (
              <li key={index}>{link}</li>
            ))}
          </ul>
          <p>Showing up to 100 targets. Links are not opened.</p>
        </details>
      )}
      <label className="field">
        Extracted file text
        <textarea
          className="plaintext-terminal"
          aria-label="Extracted file text"
          readOnly
          rows={12}
          value={report.text}
        />
      </label>
      <p className="helper-text">
        This is the parser's text stream from these uploaded bytes. Review the
        original file alongside it. There is no ATS score or acceptance
        guarantee.
      </p>
    </section>
  );
}

export function FileDiagnostics({ doc }: { doc: ResumeDocument }) {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    report: FileDiagnosticReport;
    snapshot: string;
  } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function check() {
    if (!file || !consent) return;
    setLoading(true);
    setError("");
    const snapshot = JSON.stringify(doc);
    const controller = new AbortController();
    request.current = controller;
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("expectedDocument", snapshot);
      form.append("processingConsent", "true");
      const response = await fetch("/api/diagnostics/file", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "This file could not be checked.");
      setResult({ report: data, snapshot });
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Unable to check this file.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <div className="file-diagnostics">
      <h3>Compare an actual file with this CV</h3>
      <p>
        Choose your exported PDF or DOCX, or a UTF-8 TXT file. The check
        compares extracted source text and sequence with the current visible CV.
        It does not edit or save either document.
      </p>
      <label className="field">
        File to check
        <input
          aria-label="File to check"
          type="file"
          accept=".pdf,.docx,.txt"
          disabled={loading}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
            setError("");
          }}
        />
      </label>
      <p className="helper-text">
        Up to 5 MB; PDFs up to 40 pages. No OCR. Files and the current CV are
        sent to this application server for this request, without saving them to
        your account or sending them to an AI provider. Results stay in this
        open view.
      </p>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={consent}
          disabled={loading}
          onChange={(event) => setConsent(event.target.checked)}
        />
        Send this file and the current CV for comparison
      </label>
      <button
        type="button"
        className="primary"
        disabled={!file || !consent || loading}
        onClick={check}
      >
        {loading ? "Checking file…" : "Check this file"}
      </button>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {result && (
        <FileDiagnosticResults
          report={result.report}
          stale={result.snapshot !== JSON.stringify(doc)}
        />
      )}
    </div>
  );
}
