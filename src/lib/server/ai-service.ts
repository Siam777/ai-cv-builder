import { createHash } from "node:crypto";
import { database } from "./database";
import { getResume, saveResume } from "./resumes";
import { type GenerateRequest, rewriteContext } from "../ai-contract";
import {
  applyReviewedProposal,
  proposalSchema,
  reviewProposal,
} from "../ai-proposals";
import { documentSchema } from "../document";
import {
  generateRewrite,
  openAIConfigured,
  openAIModel,
  PROMPT_VERSION,
} from "./openai-provider";
import { HttpError } from "./http";

const conflict = () =>
  new HttpError(
    409,
    "AI_STALE",
    "This resume changed. Close the assistant, reload the saved resume, and generate a new proposal.",
  );
const limit = (value: string | undefined, fallback: number) =>
  value && /^\d+$/.test(value) ? Math.min(Number(value), 1000) : fallback;
export async function requestRewrite(
  owner: string,
  input: GenerateRequest,
  generator = generateRewrite,
) {
  const doc = await getResume(owner, input.documentId);
  if (doc.revision !== input.revision) throw conflict();
  try {
    rewriteContext(doc, input.bulletId);
  } catch (error) {
    throw new HttpError(400, "AI_CONTEXT", (error as Error).message);
  }
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        input.documentId,
        input.revision,
        input.bulletId,
        input.instruction,
      ]),
    )
    .digest("hex");
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const client = database().client;
  const tx = await client.transaction("write");
  try {
    const row = (
      await tx.execute({
        sql: "SELECT * FROM ai_requests WHERE owner_id=? AND id=?",
        args: [owner, input.requestId],
      })
    ).rows[0];
    if (row) {
      if (row.request_hash !== hash)
        throw new HttpError(
          409,
          "AI_REQUEST_CHANGED",
          "This request identifier was already used. Start a new request.",
        );
      if (row.status === "review" && Number(row.expires_at) > now) {
        await tx.commit();
        return proposalSchema.parse(JSON.parse(String(row.proposal)));
      }
      throw new HttpError(
        409,
        row.status === "generating" && Number(row.created_at) > now - 90000
          ? "AI_PENDING"
          : "AI_FINISHED",
        "This request is already processing or finished. Retry shortly, or start a new request.",
      );
    }
    if (!openAIConfigured())
      throw new HttpError(
        503,
        "AI_NOT_CONFIGURED",
        "OpenAI is not configured on this installation yet.",
      );
    const active = (
      await tx.execute({
        sql: "SELECT count(*) AS n FROM ai_requests WHERE owner_id=? AND status='generating' AND created_at>?",
        args: [owner, now - 90000],
      })
    ).rows[0];
    if (Number(active.n) >= 2)
      throw new HttpError(
        429,
        "AI_BUSY",
        "Two AI requests are already running for your account. Wait before trying again.",
      );
    const used = (
      await tx.execute({
        sql: "SELECT count FROM ai_owner_usage WHERE owner_id=? AND day=?",
        args: [owner, day],
      })
    ).rows[0];
    const global = (
      await tx.execute({
        sql: "SELECT count FROM ai_global_usage WHERE day=?",
        args: [day],
      })
    ).rows[0];
    if (
      Number(used?.count ?? 0) >= limit(process.env.AI_DAILY_USER_LIMIT, 20) ||
      Number(global?.count ?? 0) >=
        limit(process.env.AI_DAILY_GLOBAL_LIMIT, 200)
    )
      throw new HttpError(
        429,
        "AI_LIMIT",
        "The daily AI request limit has been reached. Try again tomorrow.",
      );
    await tx.execute({
      sql: "INSERT INTO ai_owner_usage VALUES (?,?,1) ON CONFLICT(owner_id,day) DO UPDATE SET count=count+1",
      args: [owner, day],
    });
    await tx.execute({
      sql: "INSERT INTO ai_global_usage VALUES (?,1) ON CONFLICT(day) DO UPDATE SET count=count+1",
      args: [day],
    });
    await tx.execute({
      sql: "INSERT INTO ai_requests(owner_id,id,resume_id,request_hash,base_revision,status,created_at,expires_at) VALUES (?,?,?,?,?,'generating',?,?)",
      args: [
        owner,
        input.requestId,
        doc.id,
        hash,
        doc.revision,
        now,
        now + 86400000,
      ],
    });
    await tx.commit();
  } finally {
    tx.close();
  }
  try {
    const draft = await generator(doc, input.bulletId, input.instruction);
    const target = draft.context.selected;
    const proposal = proposalSchema.parse({
      schemaVersion: 1,
      id: input.requestId,
      documentId: doc.id,
      baseRevision: doc.revision,
      message: draft.message,
      questions: draft.questions,
      operations: draft.text
        ? [
            {
              type: "replaceBullet",
              sectionId: target.sectionId,
              entryId: target.entryId,
              bulletId: target.id,
              before: target.text,
              text: draft.text,
              evidenceIds: draft.evidenceIds,
            },
          ]
        : [],
    });
    reviewProposal(doc, proposal);
    if ((await getResume(owner, doc.id)).revision !== doc.revision)
      throw conflict();
    const saved = await client.execute({
      sql: "UPDATE ai_requests SET status='review',proposal=?,evidence_snapshot=?,prompt_version=?,model=? WHERE owner_id=? AND id=? AND status='generating'",
      args: [
        JSON.stringify(proposal),
        JSON.stringify(draft.context.sources),
        PROMPT_VERSION,
        openAIModel(),
        owner,
        input.requestId,
      ],
    });
    if (saved.rowsAffected !== 1) throw conflict();
    return proposal;
  } catch (error) {
    await client.execute({
      sql: "UPDATE ai_requests SET status='failed' WHERE owner_id=? AND id=? AND status='generating'",
      args: [owner, input.requestId],
    });
    throw error;
  }
}

export async function decideProposal(
  owner: string,
  id: string,
  decision: "accept" | "reject",
) {
  const tx = await database().client.transaction("write");
  try {
    const row = (
      await tx.execute({
        sql: "SELECT * FROM ai_requests WHERE owner_id=? AND id=?",
        args: [owner, id],
      })
    ).rows[0];
    if (!row)
      throw new HttpError(
        404,
        "AI_NOT_FOUND",
        "This proposal is not available in your account.",
      );
    if (decision === "reject") {
      if (row.status !== "review" && row.status !== "rejected")
        throw conflict();
      await tx.execute({
        sql: "UPDATE ai_requests SET status='rejected',proposal=NULL,evidence_snapshot=NULL WHERE owner_id=? AND id=?",
        args: [owner, id],
      });
      await tx.commit();
      return { rejected: true };
    }
    const saved = (
      await tx.execute({
        sql: "SELECT document FROM resumes WHERE owner_id=? AND id=?",
        args: [owner, row.resume_id],
      })
    ).rows[0];
    if (!saved) throw conflict();
    const doc = documentSchema.parse(JSON.parse(String(saved.document)));
    if (row.status === "applied") {
      if (doc.revision !== Number(row.result_revision)) throw conflict();
      await tx.commit();
      return { document: doc, alreadyApplied: true };
    }
    if (
      row.status !== "review" ||
      Number(row.expires_at) <= Date.now() ||
      doc.revision !== Number(row.base_revision)
    )
      throw conflict();
    const result = applyReviewedProposal(
      doc,
      JSON.parse(String(row.proposal)),
      new Set(),
    );
    const next = await saveResume(owner, result.document, doc.revision, tx);
    await tx.execute({
      sql: "UPDATE ai_requests SET status='applied',result_revision=? WHERE owner_id=? AND id=?",
      args: [next.revision, owner, id],
    });
    await tx.commit();
    return { document: next, alreadyApplied: false };
  } finally {
    tx.close();
  }
}
