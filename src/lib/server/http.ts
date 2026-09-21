import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function handle(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.code, message: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        {
          error: "INVALID_INPUT",
          message: "Check the submitted fields. No changes were saved.",
        },
        400,
      );
    return json(
      {
        error: "SERVICE_UNAVAILABLE",
        message:
          "The account service could not complete this request. Your current edits have been kept; try again or download a recovery backup.",
      },
      503,
    );
  }
}
export function requireSameOrigin(request: Request, configuredOrigin?: string) {
  const expected = configuredOrigin || new URL(request.url).origin;
  if (
    request.headers.get("origin") !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(
      403,
      "ORIGIN_REJECTED",
      "This request must come from the resume application.",
    );
}
export async function readJson(
  request: Request,
  maximum = 2_100_000,
): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpError(415, "JSON_REQUIRED", "Send a JSON request.");
  if (Number(request.headers.get("content-length")) > maximum)
    throw new HttpError(
      413,
      "TOO_LARGE",
      "This request is too large. Import fewer resumes at a time.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "EMPTY_BODY", "The request is empty.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maximum) {
        await reader.cancel();
        throw new HttpError(
          413,
          "TOO_LARGE",
          "This request is too large. Import fewer resumes at a time.",
        );
      }
      body += decoder.decode(result.value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new HttpError(
        400,
        "INVALID_JSON",
        "The request contains invalid JSON.",
      );
    throw error;
  } finally {
    reader.releaseLock();
  }
}
