import { exportRequestSchema } from "../export-contract";
import { toPlainText } from "../document";
import { exportToDocx } from "../exporters/docx-exporter";
import { exportToMarkdown } from "../exporters/markdown-exporter";
import { authorizedExport, origin } from "./auth";
import { getResume } from "./resumes";
import { getUserSubscription } from "./entitlements";
import { handle, HttpError, readJson, requireSameOrigin } from "./http";
import { renderResumeHtml, renderResumePdf } from "./pdf-generator";
import { checkRateLimit } from "./rate-limiter";
import { letterDocument } from "../letter-layout";

export function handleExport(request: Request, pdfOnly = false) {
  return handle(async () => {
    requireSameOrigin(request, origin());
    const { user } = await authorizedExport(request);
    checkRateLimit("document_export", user.id, {
      windowMs: 60000,
      maxRequests: 30,
      errorCode: "EXPORT_RATE_LIMIT",
      errorMessage: "Too many exports. Please wait a minute and try again.",
    });
    const input = exportRequestSchema.parse(await readJson(request, 4_000_000));
    if (pdfOnly && (input.kind !== "resume" || input.format !== "pdf"))
      throw new HttpError(400, "PDF_REQUIRED", "Choose PDF for this endpoint.");
    const doc =
      input.source.storage === "account"
        ? await getResume(user.id, input.source.documentId)
        : input.source.document;
    if (
      input.source.storage === "account" &&
      doc.revision !== input.source.revision
    )
      throw new HttpError(
        409,
        "REVISION_CONFLICT",
        "This CV changed elsewhere. Refresh it before exporting.",
      );
    const subscription = await getUserSubscription(user.id);
    const showWatermark = !subscription.entitlements.watermark_free_export;
    let content: string | Uint8Array;
    let mime = "text/plain;charset=utf-8";
    let extension: string = input.format;
    const sample = doc.provenance.purpose === "practice";
    const renderDoc = structuredClone(doc);
    if (sample)
      renderDoc.contact.headline = `Fictional practice CV · ${doc.contact.headline}`;
    if (input.kind === "letter") {
      content = `${sample ? "Fictional practice example\n\n" : ""}${input.text}`;
      if (input.format === "print") {
        content = await renderResumeHtml(letterDocument(renderDoc, content), {
          showWatermark,
        });
        mime = "text/html;charset=utf-8";
        extension = "html";
      } else if (input.format === "md") mime = "text/markdown;charset=utf-8";
      else extension = "txt";
    } else {
      switch (input.format) {
        case "pdf":
          content = await renderResumePdf(renderDoc, { showWatermark });
          mime = "application/pdf";
          break;
        case "docx":
          content = exportToDocx(renderDoc, { showWatermark });
          mime =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          break;
        case "html":
        case "print":
          content = await renderResumeHtml(renderDoc, { showWatermark });
          mime = "text/html;charset=utf-8";
          extension = "html";
          break;
        case "md":
          content = exportToMarkdown(renderDoc);
          mime = "text/markdown;charset=utf-8";
          break;
        case "json":
          content = JSON.stringify(doc, null, 2);
          mime = "application/json";
          break;
        default:
          content = toPlainText(renderDoc);
      }
    }
    const latest = await authorizedExport(request);
    if (latest.user.id !== user.id)
      throw new HttpError(
        409,
        "WORKSPACE_CHANGED",
        "The account changed. Sign in again before exporting.",
      );
    const name =
      (input.kind === "letter" ? input.name : doc.name)
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 100) || "resume";
    return new Response(
      typeof content === "string" ? content : Buffer.from(content),
      {
        headers: {
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="resume.${extension}"; filename*=UTF-8''${encodeURIComponent(name)}.${extension}`,
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  });
}
