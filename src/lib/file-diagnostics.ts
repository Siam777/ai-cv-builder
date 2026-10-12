export const FILE_DIAGNOSTIC_VERSION = "2026-10-11.q4.1";
export type FileDiagnosticCheck = {
  id: string;
  label: string;
  status: "observed" | "issue" | "not_checked";
  detail: string;
};
export type FileDiagnosticReport = {
  version: string;
  analyzedAt: string;
  file: {
    name: string;
    format: "pdf" | "docx" | "txt";
    size: number;
    sha256: string;
  };
  parser: { name: string; version: string };
  text: string;
  pageCount: number | null;
  links: string[];
  checks: FileDiagnosticCheck[];
  comparison: null | {
    documentId: string;
    revision: number;
    contentHash: string;
    expectedCount: number;
    foundCount: number;
    missingCount: number;
    outOfOrderCount: number;
    findings: {
      id: string;
      text: string;
      status: "missing" | "out_of_order";
    }[];
  };
};
