import { HttpError } from "./http";
import { checkRateLimit } from "./rate-limiter";

/** Bound multipart bytes before allocating/parsing files, including requests
 * without Content-Length. Uploads remain in memory for the current request. */
export async function readFileUpload(request: Request) {
  checkRateLimit(
    "file_extraction",
    request.headers.get("x-forwarded-for")?.split(",")[0].slice(0, 100) ||
      "public",
    { windowMs: 60000, maxRequests: 30 },
  );
  const maximum = 7_100_000;
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data"))
    throw new HttpError(415, "MULTIPART_REQUIRED", "Select a file to upload.");
  if (Number(request.headers.get("content-length")) > maximum)
    throw new HttpError(
      413,
      "UPLOAD_TOO_LARGE",
      "The upload exceeds the request limit.",
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new HttpError(400, "FILE_REQUIRED", "Select a file to check.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new HttpError(
          413,
          "UPLOAD_TOO_LARGE",
          "The upload exceeds the request limit.",
        );
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new HttpError(
      400,
      "INVALID_UPLOAD",
      "Choose the file again; this upload could not be read.",
    );
  }
  const file = form.get("file");
  if (!(file instanceof File))
    throw new HttpError(400, "FILE_REQUIRED", "Select a file to check.");
  return { file, form };
}
