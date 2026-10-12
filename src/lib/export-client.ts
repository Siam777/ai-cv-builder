import type { ExportRequest } from "./export-contract";
import { CloudRequestError } from "./cloud-repository";

export async function requestExport(input: ExportRequest, owner: string) {
  const response = await fetch("/api/exports", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Workspace-User": owner },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new CloudRequestError(
      response.status,
      error.error || "EXPORT_FAILED",
      error.message || "Export failed. Your edits are kept. Please retry.",
    );
  }
  const filename = response.headers
    .get("Content-Disposition")
    ?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  return {
    blob: await response.blob(),
    filename: filename ? decodeURIComponent(filename) : "resume",
  };
}

export function downloadArtifact(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function printArtifact(blob: Blob) {
  const frame = document.createElement("iframe");
  frame.title = "Authorized print preview";
  frame.style.cssText =
    "position:fixed;width:1px;height:1px;bottom:0;left:0;border:0";
  frame.setAttribute("sandbox", "allow-same-origin allow-modals");
  frame.onload = async () => {
    await frame.contentDocument?.fonts.ready;
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
  };
  frame.srcdoc = await blob.text();
  document.body.append(frame);
}
