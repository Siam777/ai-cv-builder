import { z } from "zod";
import { documentSchema } from "@/lib/document";
import { auth, origin } from "@/lib/server/auth";
import { handle, readJson, requireSameOrigin } from "@/lib/server/http";
import { getUserSubscription } from "@/lib/server/entitlements";
import { renderResumePdf } from "@/lib/server/pdf-generator";
import { checkRateLimit } from "@/lib/server/rate-limiter";
import { logOperation } from "@/lib/server/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const exportPdfSchema = z.strictObject({
  document: documentSchema,
});

export async function POST(request: Request) {
  const startTime = Date.now();
  return handle(async () => {
    requireSameOrigin(request, origin());
    const body = exportPdfSchema.parse(await readJson(request, 1024 * 1024));

    // Determine watermark based on user subscription
    const session = await auth().api.getSession({ headers: request.headers });
    const userId = session?.user?.id ?? null;

    // Rate limiting: max 15 PDF exports per minute per client/session
    const rateLimitKey =
      userId ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "anonymous";
    checkRateLimit("pdf_export", rateLimitKey, {
      windowMs: 60_000,
      maxRequests: 15,
      errorCode: "EXPORT_RATE_LIMIT",
      errorMessage: "Too many PDF export requests. Please wait a minute before exporting again.",
    });

    const subscription = await getUserSubscription(userId);
    const showWatermark = !subscription.entitlements.watermark_free_export;

    const pdfBuffer = await renderResumePdf(body.document, { showWatermark });

    logOperation({
      level: "info",
      event: "export_pdf_completed",
      ownerId: userId,
      documentId: body.document.id,
      revision: body.document.revision,
      durationMs: Date.now() - startTime,
      statusCode: 200,
      metadata: {
        pageSize: body.document.presentation.pageSize,
        watermarked: showWatermark,
        byteLength: pdfBuffer.length,
      },
    });

    const safeName =
      body.document.name
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .slice(0, 100) || "resume";

    return new Response(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  });
}
