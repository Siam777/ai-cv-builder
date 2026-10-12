import { documentSchema } from "@/lib/document";
import { analyzeFile } from "@/lib/server/file-extraction";
import { readFileUpload } from "@/lib/server/file-upload";
import { handle, json, HttpError, requireSameOrigin } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request);
    const { file, form } = await readFileUpload(request);
    const raw = form.get("expectedDocument");
    let expected;
    if (raw !== null) {
      if (form.get("processingConsent") !== "true")
        throw new HttpError(
          400,
          "CONSENT_REQUIRED",
          "Confirm sending the current CV for comparison.",
        );
      if (typeof raw !== "string" || raw.length > 2_000_000)
        throw new HttpError(
          413,
          "DOCUMENT_TOO_LARGE",
          "The comparison document is too large.",
        );
      try {
        expected = documentSchema.parse(JSON.parse(raw));
      } catch {
        throw new HttpError(
          400,
          "INVALID_DOCUMENT",
          "The current CV could not be validated. Reopen it and try again.",
        );
      }
    }
    return json(await analyzeFile(file, expected));
  });
}
