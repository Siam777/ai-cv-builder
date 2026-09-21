import { z } from "zod";
import { documentSchema, type ResumeDocument } from "./document";
import type { ResumeRepository } from "./repository";
import { importReceiptSchema } from "./cloud-contract";

export class CloudRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function accountRequest(
  path: string,
  options: RequestInit = {},
  owner?: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(20000),
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(owner ? { "X-Workspace-User": owner } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new CloudRequestError(
      0,
      "NETWORK_ERROR",
      "Could not reach account storage. Your edits are still here. Check the connection, then retry or download a recovery backup.",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new CloudRequestError(
      response.status,
      body?.error ?? "REQUEST_FAILED",
      body?.message ?? "The account request failed. Your edits have been kept.",
    );
  return body;
}
export function createCloudRepository(
  owner: string,
): ResumeRepository & { get: (id: string) => Promise<ResumeDocument> } {
  return {
    async list() {
      return z
        .array(documentSchema)
        .parse(await accountRequest("/api/resumes", {}, owner));
    },
    async get(id) {
      return documentSchema.parse(
        await accountRequest(
          `/api/resumes/${encodeURIComponent(id)}`,
          {},
          owner,
        ),
      );
    },
    async save(document, expectedRevision) {
      return documentSchema.parse(
        await accountRequest(
          "/api/resumes",
          {
            method: "POST",
            body: JSON.stringify({ document, expectedRevision }),
          },
          owner,
        ),
      );
    },
    async remove(id, expectedRevision) {
      await accountRequest(
        `/api/resumes/${encodeURIComponent(id)}`,
        { method: "DELETE", body: JSON.stringify({ expectedRevision }) },
        owner,
      );
    },
  };
}
export async function importReceipts(owner: string) {
  return z
    .array(importReceiptSchema)
    .parse(await accountRequest("/api/resumes/import", {}, owner));
}
export async function transferLocalResumes(
  owner: string,
  documents: ResumeDocument[],
) {
  return z
    .array(
      z.object({
        sourceId: z.string(),
        resumeId: z.string(),
        status: z.enum(["imported", "already_imported"]),
      }),
    )
    .parse(
      await accountRequest(
        "/api/resumes/import",
        { method: "POST", body: JSON.stringify({ documents }) },
        owner,
      ),
    );
}
