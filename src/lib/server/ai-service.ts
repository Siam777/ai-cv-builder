import { createHash } from "node:crypto";
import { database } from "./database";
import { getResume, saveResume } from "./resumes";
import {
  type GenerateRequest,
  generateSchema,
  rewriteContext,
  type SummaryRequest,
  summaryRequestSchema,
  summaryEvidence,
  type EntryBulletsRequest,
  type EntryBulletsResult,
  entryBulletsRequestSchema,
  entryEvidence,
  type StartersRequest,
  type StartersResult,
  startersRequestSchema,
  starterCacheKey,
  type SkillsRequest,
  type SkillsResult,
  skillsRequestSchema,
  interviewStartSchema,
  type InterviewStepRequest,
  type InterviewStepResult,
  interviewStepSchema,
  type JobMatchRequest,
  type JobMatchResult,
  jobMatchRequestSchema,
  type GapLineRequest,
  type GapLineResult,
  gapLineRequestSchema,
  type TailorRequest,
  type TailorResult,
  tailorRequestSchema,
  type CoverLetterRequest,
  type CoverLetterResult,
  coverLetterRequestSchema,
  type ImportTidyRequest,
  type ImportTidyResult,
  importTidyRequestSchema,
  type AskRequest,
  type AskResult,
  askRequestSchema,
} from "../ai-contract";
import { createCoachingProposal, JOB_COACH_PROMPT_VERSION } from "../job-coach";
import { jobCoachContext } from "./job-coach-context";
import {
  applyReviewedProposal,
  proposalSchema,
  reviewProposal,
} from "../ai-proposals";
import { documentSchema } from "../document";
import {
  generateImproveAll,
  generateRewrite,
  generateJobCoaching,
  generateSummary,
  SUMMARY_PROMPT_VERSION,
  generateEntryBullets,
  ENTRY_PROMPT_VERSION,
  generateStarters,
  STARTERS_PROMPT_VERSION,
  generateSkillSuggestions,
  SKILLS_PROMPT_VERSION,
  generateInterviewStep,
  INTERVIEW_PROMPT_VERSION,
  generateJobMatch,
  JOB_MATCH_PROMPT_VERSION,
  generateGapLine,
  GAP_LINE_PROMPT_VERSION,
  generateTailoring,
  TAILOR_PROMPT_VERSION,
  generateCoverLetterDraft,
  COVER_LETTER_PROMPT_VERSION,
  generateImportTidy,
  IMPORT_TIDY_PROMPT_VERSION,
  generateAsk,
  ASK_PROMPT_VERSION,
  openAIConfigured,
  openAIModel,
  PROMPT_VERSION,
} from "./openai-provider";
import { HttpError } from "./http";
import { getUserSubscription } from "./entitlements";
import { logOperation } from "./logger";
import { requireAiConsent } from "./ai-consent";

const conflict = () =>
  new HttpError(
    409,
    "AI_STALE",
    "This resume changed. Close the assistant, reload the saved resume, and generate a new proposal.",
  );
const limit = (value: string | undefined, fallback: number) =>
  value && /^\d+$/.test(value) ? Math.min(Number(value), 1000) : fallback;
/** The plan's daily AI requests; AI_DAILY_USER_LIMIT, when set, caps every plan. */
export const dailyLimit = (planLimit: number) =>
  Math.min(planLimit, limit(process.env.AI_DAILY_USER_LIMIT, planLimit));
/** Stores a reviewed proposal for acceptance; shared by every /api/ai mode. */
async function storeProposal(
  owner: string,
  doc: Awaited<ReturnType<typeof getResume>>,
  requestId: string,
  started: number,
  mode: string,
  proposal: ReturnType<typeof proposalSchema.parse>,
  sources: unknown,
  promptVersion: string,
) {
  reviewProposal(doc, proposal);
  if ((await getResume(owner, doc.id)).revision !== doc.revision) throw conflict();
  const saved = await database().client.execute({
    sql: "UPDATE ai_requests SET status='review',proposal=?,evidence_snapshot=?,prompt_version=?,model=? WHERE owner_id=? AND id=? AND status='generating'",
    args: [
      JSON.stringify(proposal),
      JSON.stringify(sources),
      promptVersion,
      openAIModel(),
      owner,
      requestId,
    ],
  });
  if (saved.rowsAffected !== 1) throw conflict();
  logOperation({
    level: "info",
    event: "ai_proposal_generated",
    ownerId: owner,
    documentId: doc.id,
    revision: doc.revision,
    durationMs: Date.now() - started,
    statusCode: 200,
    metadata: {
      model: openAIModel(),
      promptVersion,
      mode,
      operationCount: proposal.operations.length,
      hasOperation: proposal.operations.length > 0,
      questionCount: proposal.questions.length,
    },
  });
  return proposal;
}

export async function requestRewrite(
  owner: string,
  input: GenerateRequest,
  generator = generateRewrite,
  coachGenerator = generateJobCoaching,
  entryGenerator = generateImproveAll,
) {
  input = generateSchema.parse(input);
  const mode = input.mode ?? "rewrite";
  const { plan } = await getUserSubscription(owner);
  if (input.job && mode !== "rewrite")
    throw new HttpError(400, "AI_MODE", "Job coaching works on one bullet at a time.");
  if (mode === "entry" && !plan.aiImproveAll)
    throw new HttpError(
      402,
      "PLAN_REQUIRED",
      "Improving every bullet of a job in one go is part of Go and Pro. Improve wording works on each bullet on every plan.",
    );
  if (input.job && !plan.jobCoaching)
    throw new HttpError(
      402,
      "PLAN_REQUIRED",
      "AI job coaching is part of the Pro plan. The job comparison itself stays free.",
    );
  const doc = await getResume(owner, input.documentId);
  if (doc.revision !== input.revision) throw conflict();
  try {
    const { selected } = rewriteContext(doc, input.bulletId);
    if (
      mode === "selection" &&
      (!input.selection ||
        input.selection.start >= input.selection.end ||
        input.selection.end > selected.text.length ||
        !selected.text.slice(input.selection.start, input.selection.end).trim())
    )
      throw new Error("Select some words in this bullet first.");
  } catch (error) {
    throw new HttpError(400, "AI_CONTEXT", (error as Error).message);
  }
  const job = input.job
    ? await jobCoachContext(doc, input.bulletId, input.job)
    : null;
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        input.documentId,
        input.revision,
        input.bulletId,
        input.instruction,
        ...(input.job ? [input.job] : []),
        ...(mode !== "rewrite" ? [mode, input.selection ?? null] : []),
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
    if (Number(used?.count ?? 0) >= dailyLimit(plan.aiRequestsPerDay))
      throw new HttpError(
        429,
        "AI_LIMIT",
        `You have used today's ${dailyLimit(plan.aiRequestsPerDay)} AI requests on the ${plan.name} plan. Try again tomorrow, or choose a plan with more.`,
      );
    if (
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
  const saveProposal = (
    proposal: ReturnType<typeof proposalSchema.parse>,
    sources: unknown,
    promptVersion: string,
  ) => storeProposal(owner, doc, input.requestId, now, mode, proposal, sources, promptVersion);
  try {
    if (mode === "entry") {
      const improved = await entryGenerator(doc, input.bulletId, input.instruction);
      const entryOf = (id: string) => improved.context.sources.find((source) => source.id === id)!;
      const notes = improved.withheld
        ? ` ${improved.withheld} suggestion${improved.withheld === 1 ? " was" : "s were"} withheld because your bullets do not support ${improved.withheld === 1 ? "it" : "them"}.`
        : "";
      const proposal = proposalSchema.parse({
        schemaVersion: 1,
        id: input.requestId,
        documentId: doc.id,
        baseRevision: doc.revision,
        message: `${improved.message}${notes}`.trim().slice(0, 2000),
        questions: improved.questions,
        operations: improved.rewrites.map((rewrite) => ({
          type: "replaceBullet",
          sectionId: entryOf(rewrite.bulletId).sectionId,
          entryId: entryOf(rewrite.bulletId).entryId,
          bulletId: rewrite.bulletId,
          before: rewrite.before,
          text: rewrite.text,
          evidenceIds: rewrite.evidenceIds,
        })),
      });
      return await saveProposal(proposal, improved.context.sources, PROMPT_VERSION);
    }
    const draft = job
      ? await coachGenerator(doc, input.bulletId, input.instruction, job)
      : await generator(
          doc,
          input.bulletId,
          input.instruction,
          undefined,
          mode === "rewrite" ? {} : { mode, selection: input.selection },
        );
    const promptVersion = job ? JOB_COACH_PROMPT_VERSION : PROMPT_VERSION;
    const target = draft.context.selected;
    const proposal =
      "draft" in draft
        ? createCoachingProposal({
            doc,
            job: job!,
            bulletId: input.bulletId,
            requestId: input.requestId,
            draft: draft.draft,
            assessmentSupport: draft.assessmentSupport,
            rewriteSupport: draft.rewriteSupport,
            model: openAIModel(),
            analyzedAt: new Date().toISOString(),
          })
        : proposalSchema.parse({
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
    return await saveProposal(proposal, draft.context.sources, promptVersion);
  } catch (error) {
    logOperation({
      level: "warn",
      event: "ai_proposal_failed",
      ownerId: owner,
      documentId: input.documentId,
      revision: input.revision,
      durationMs: Date.now() - now,
      errorCode: error instanceof HttpError ? error.code : "INTERNAL_ERROR",
    });
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
  bulletIds?: string[],
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
      logOperation({
        level: "info",
        event: "ai_proposal_rejected",
        ownerId: owner,
        documentId: row.resume_id ? String(row.resume_id) : undefined,
      });
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
    let result;
    try {
      result = applyReviewedProposal(
        doc,
        JSON.parse(String(row.proposal)),
        new Set(),
        bulletIds ? new Set(bulletIds) : undefined,
      );
    } catch (error) {
      throw new HttpError(400, "AI_DECISION", (error as Error).message);
    }
    const next = await saveResume(owner, result.document, doc.revision, tx);
    await tx.execute({
      sql: "UPDATE ai_requests SET status='applied',result_revision=? WHERE owner_id=? AND id=?",
      args: [next.revision, owner, id],
    });
    await tx.commit();
    logOperation({
      level: "info",
      event: "ai_proposal_accepted",
      ownerId: owner,
      documentId: row.resume_id ? String(row.resume_id) : undefined,
      revision: next.revision,
    });
    return { document: next, alreadyApplied: false };
  } finally {
    tx.close();
  }
}

/** Counts one AI request against the plan's daily limit and the installation cap. */
async function reserveDailyRequest(owner: string, perDay: number, planName: string) {
  const day = new Date().toISOString().slice(0, 10);
  const client = database().client;
  const tx = await client.transaction("write");
  try {
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
    if (Number(used?.count ?? 0) >= dailyLimit(perDay))
      throw new HttpError(
        429,
        "AI_LIMIT",
        `You have used today's ${dailyLimit(perDay)} AI requests on the ${planName} plan. Try again tomorrow, or choose a plan with more.`,
      );
    if (Number(global?.count ?? 0) >= limit(process.env.AI_DAILY_GLOBAL_LIMIT, 200))
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
    await tx.commit();
  } finally {
    tx.close();
  }
}

/** Shown when the CV has only a headline and job titles: nothing is sent to the AI. */
export const THIN_CV_MESSAGE =
  "Your CV only has a headline and job titles so far, which is too little to write a summary from without making things up. Add a few bullets to a job (Write with AI can turn rough notes into bullets) or list your skills, then try again. This did not use one of today's AI requests.";

/**
 * Drafts a professional summary from the saved CV (Go and Pro). Nothing is
 * saved here: the person reviews the draft and accepts it in the editor.
 */
export async function requestSummaryDraft(
  owner: string,
  input: SummaryRequest,
  generator = generateSummary,
) {
  input = summaryRequestSchema.parse(input);
  const { plan } = await getUserSubscription(owner);
  if (!plan.aiSummaryDrafts)
    throw new HttpError(
      402,
      "PLAN_REQUIRED",
      "AI summary drafts are part of Go and Pro. The quick draft works on every plan.",
    );
  if (!openAIConfigured())
    throw new HttpError(503, "AI_NOT_CONFIGURED", "OpenAI is not configured on this installation yet.");
  const doc = await getResume(owner, input.documentId);
  if (doc.revision !== input.revision) throw conflict();
  // A headline and job titles alone are too little to write from without
  // inventing; say so without spending one of the day's AI requests.
  const evidence = summaryEvidence(doc);
  if (!evidence.some((item) => ["bullet", "skills", "education", "project"].includes(item.kind)))
    return {
      requestId: input.requestId,
      text: "",
      message: THIN_CV_MESSAGE,
    };
  await reserveDailyRequest(owner, plan.aiRequestsPerDay, plan.name);
  const started = Date.now();
  try {
    const draft = await generator(doc);
    logOperation({
      level: "info",
      event: "ai_summary_generated",
      ownerId: owner,
      documentId: doc.id,
      revision: doc.revision,
      durationMs: Date.now() - started,
      statusCode: 200,
      metadata: {
        model: openAIModel(),
        promptVersion: SUMMARY_PROMPT_VERSION,
        hasText: Boolean(draft.text),
      },
    });
    return { requestId: input.requestId, text: draft.text, message: draft.message };
  } catch (error) {
    logOperation({
      level: "warn",
      event: "ai_summary_failed",
      ownerId: owner,
      documentId: doc.id,
      revision: doc.revision,
      durationMs: Date.now() - started,
      statusCode: error instanceof HttpError ? error.status : 500,
    });
    throw error;
  }
}

/**
 * Write with AI on a job or project (every plan): the person's notes become
 * 3–5 bullets for review. Nothing is saved here; the editor applies only the
 * bullets the person ticks.
 */
export async function requestEntryBullets(
  owner: string,
  input: EntryBulletsRequest,
  generator: (
    doc: Awaited<ReturnType<typeof getResume>>,
    input: EntryBulletsRequest,
  ) => ReturnType<typeof generateEntryBullets> = generateEntryBullets,
): Promise<EntryBulletsResult> {
  input = entryBulletsRequestSchema.parse(input);
  const { plan } = await getUserSubscription(owner);
  if (!plan.aiEntryBullets)
    throw new HttpError(
      402,
      "PLAN_REQUIRED",
      "Writing bullets from your notes is not part of your plan.",
    );
  await requireAiConsent(owner);
  if (!openAIConfigured())
    throw new HttpError(503, "AI_NOT_CONFIGURED", "OpenAI is not configured on this installation yet.");
  const doc = await getResume(owner, input.documentId);
  if (doc.revision !== input.revision) throw conflict();
  try {
    entryEvidence(doc, input);
  } catch (error) {
    throw new HttpError(400, "AI_CONTEXT", (error as Error).message);
  }
  await reserveDailyRequest(owner, plan.aiRequestsPerDay, plan.name);
  const started = Date.now();
  try {
    const draft = await generator(doc, input);
    logOperation({
      level: "info",
      event: "ai_entry_bullets_generated",
      ownerId: owner,
      documentId: doc.id,
      revision: doc.revision,
      durationMs: Date.now() - started,
      statusCode: 200,
      metadata: {
        model: openAIModel(),
        promptVersion: ENTRY_PROMPT_VERSION,
        bulletCount: draft.bullets.length,
        withheldCount: draft.withheld.length,
        questionCount: draft.questions.length,
      },
    });
    return {
      requestId: input.requestId,
      message: draft.message,
      title: draft.title,
      bullets: draft.bullets,
      withheld: draft.withheld,
      questions: draft.questions,
    };
  } catch (error) {
    logOperation({
      level: "warn",
      event: "ai_entry_bullets_failed",
      ownerId: owner,
      documentId: doc.id,
      revision: doc.revision,
      durationMs: Date.now() - started,
      statusCode: error instanceof HttpError ? error.status : 500,
    });
    throw error;
  }
}

const STARTER_CACHE_MS = 30 * 86_400_000;

/**
 * Example bullets, summary and skills for a job title (every plan). Every
 * request counts toward the daily limit; results are cached per title and
 * seniority so repeat requests cost no provider call.
 */
export async function requestStarters(
  owner: string,
  input: StartersRequest,
  generator: (input: StartersRequest) => ReturnType<typeof generateStarters> = generateStarters,
): Promise<StartersResult> {
  input = startersRequestSchema.parse(input);
  const { plan } = await getUserSubscription(owner);
  if (!plan.aiStarters)
    throw new HttpError(
      402,
      "PLAN_REQUIRED",
      "Examples for your job title are not part of your plan.",
    );
  await requireAiConsent(owner);
  if (!openAIConfigured())
    throw new HttpError(503, "AI_NOT_CONFIGURED", "OpenAI is not configured on this installation yet.");
  await reserveDailyRequest(owner, plan.aiRequestsPerDay, plan.name);
  const key = starterCacheKey(input.jobTitle, input.seniority);
  const client = database().client;
  const started = Date.now();
  const result = (cached: boolean, value: { bullets: string[]; summary: string; skills: string[] }) => ({
    requestId: input.requestId,
    jobTitle: input.jobTitle,
    seniority: input.seniority ?? null,
    cached,
    bullets: value.bullets,
    summary: value.summary,
    skills: value.skills,
  });
  const hit = (
    await client.execute({
      sql: "SELECT payload FROM ai_starter_cache WHERE cache_key=? AND prompt_version=? AND created_at>?",
      args: [key, STARTERS_PROMPT_VERSION, started - STARTER_CACHE_MS],
    })
  ).rows[0];
  if (hit) return result(true, JSON.parse(String(hit.payload)));
  try {
    const examples = await generator(input);
    if (!examples.bullets.length && !examples.summary)
      throw new HttpError(
        422,
        "AI_NO_EXAMPLES",
        "No examples came back for this job title. Check the spelling, or try a more common title.",
      );
    await client.execute({
      sql: "INSERT INTO ai_starter_cache VALUES (?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,prompt_version=excluded.prompt_version,model=excluded.model,created_at=excluded.created_at",
      args: [
        key,
        input.jobTitle,
        input.seniority ?? "",
        JSON.stringify(examples),
        STARTERS_PROMPT_VERSION,
        openAIModel(),
        started,
      ],
    });
    logOperation({
      level: "info",
      event: "ai_starters_generated",
      ownerId: owner,
      durationMs: Date.now() - started,
      statusCode: 200,
      metadata: {
        model: openAIModel(),
        promptVersion: STARTERS_PROMPT_VERSION,
        bulletCount: examples.bullets.length,
        skillCount: examples.skills.length,
      },
    });
    return result(false, examples);
  } catch (error) {
    logOperation({
      level: "warn",
      event: "ai_starters_failed",
      ownerId: owner,
      durationMs: Date.now() - started,
      statusCode: error instanceof HttpError ? error.status : 500,
    });
    throw error;
  }
}

/**
 * Suggest skills with AI (Go and Pro): skills the CV shows, each quoting its
 * evidence and support-checked; common skills for the role as examples; and a
 * grouping of the skills already listed. Nothing is saved here.
 */
export async function requestSkillSuggestions(
  owner: string,
  input: SkillsRequest,
  generator: (
    doc: Awaited<ReturnType<typeof getResume>>,
    input: SkillsRequest,
  ) => ReturnType<typeof generateSkillSuggestions> = generateSkillSuggestions,
): Promise<SkillsResult> {
  input = skillsRequestSchema.parse(input);
  const { plan } = await getUserSubscription(owner);
  if (!plan.aiSkills)
    throw new HttpError(
      402,
      "PLAN_REQUIRED",
      "Suggesting skills with AI is part of Go and Pro. Add skills from my CV works on every plan.",
    );
  await requireAiConsent(owner);
  if (!openAIConfigured())
    throw new HttpError(503, "AI_NOT_CONFIGURED", "OpenAI is not configured on this installation yet.");
  const doc = await getResume(owner, input.documentId);
  if (doc.revision !== input.revision) throw conflict();
  await reserveDailyRequest(owner, plan.aiRequestsPerDay, plan.name);
  const started = Date.now();
  try {
    const result = await generator(doc, input);
    logOperation({
      level: "info",
      event: "ai_skills_generated",
      ownerId: owner,
      documentId: doc.id,
      revision: doc.revision,
      durationMs: Date.now() - started,
      statusCode: 200,
      metadata: {
        model: openAIModel(),
        promptVersion: SKILLS_PROMPT_VERSION,
        demonstratedCount: result.demonstrated.length,
        suggestionCount: result.roleSuggestions.length,
        groupCount: result.groups.length,
        withheldCount: result.withheld,
      },
    });
    return { requestId: input.requestId, ...result };
  } catch (error) {
    logOperation({
      level: "warn",
      event: "ai_skills_failed",
      ownerId: owner,
      documentId: doc.id,
      revision: doc.revision,
      durationMs: Date.now() - started,
      statusCode: error instanceof HttpError ? error.status : 500,
    });
    throw error;
  }
}

/**
 * Starts an AI interview for an account CV. Free includes one interview in
 * total; Go and Pro are unlimited. No AI request is made or counted here.
 */
export async function startInterview(owner: string, input: { documentId: string }) {
  input = interviewStartSchema.parse(input);
  const { plan } = await getUserSubscription(owner);
  await requireAiConsent(owner);
  const doc = await getResume(owner, input.documentId);
  const client = database().client;
  const used = Number(
    (
      await client.execute({
        sql: "SELECT count(*) AS n FROM ai_interviews WHERE owner_id=?",
        args: [owner],
      })
    ).rows[0].n,
  );
  if (used >= plan.aiInterviews)
    throw new HttpError(
      402,
      "PLAN_REQUIRED",
      "Free includes one AI interview, and you have used it. Go and Pro include as many as you need. Write with AI and examples still work on every job.",
    );
  const id = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO ai_interviews VALUES (?,?,?,?)",
    args: [owner, id, doc.id, Date.now()],
  });
  logOperation({ level: "info", event: "ai_interview_started", ownerId: owner, documentId: doc.id });
  return {
    interviewId: id,
    remaining: Number.isFinite(plan.aiInterviews) ? plan.aiInterviews - used - 1 : null,
  };
}

/**
 * One interview answer (education, or tools, languages and certificates)
 * becomes structured CV items, using only the person's words. Counts as one
 * AI request. Jobs use Write with AI (entry bullets) instead.
 */
export async function requestInterviewStep(
  owner: string,
  input: InterviewStepRequest,
  generator: (
    input: InterviewStepRequest,
  ) => ReturnType<typeof generateInterviewStep> = generateInterviewStep,
): Promise<InterviewStepResult> {
  input = interviewStepSchema.parse(input);
  const { plan } = await getUserSubscription(owner);
  if (plan.aiInterviews <= 0)
    throw new HttpError(402, "PLAN_REQUIRED", "AI interviews are not part of your plan.");
  await requireAiConsent(owner);
  if (!openAIConfigured())
    throw new HttpError(503, "AI_NOT_CONFIGURED", "OpenAI is not configured on this installation yet.");
  const interview = (
    await database().client.execute({
      sql: "SELECT id FROM ai_interviews WHERE owner_id=? AND id=?",
      args: [owner, input.interviewId],
    })
  ).rows[0];
  if (!interview)
    throw new HttpError(
      404,
      "AI_INTERVIEW_NOT_FOUND",
      "This interview is not available in your account. Start it again.",
    );
  await reserveDailyRequest(owner, plan.aiRequestsPerDay, plan.name);
  const started = Date.now();
  try {
    const result = await generator(input);
    logOperation({
      level: "info",
      event: "ai_interview_step",
      ownerId: owner,
      durationMs: Date.now() - started,
      statusCode: 200,
      metadata: {
        model: openAIModel(),
        promptVersion: INTERVIEW_PROMPT_VERSION,
        step: input.step,
        itemCount:
          result.education.length +
          result.skills.length +
          result.languages.length +
          result.certifications.length,
        droppedCount: result.dropped,
      },
    });
    return { requestId: input.requestId, step: input.step, ...result };
  } catch (error) {
    logOperation({
      level: "warn",
      event: "ai_interview_step_failed",
      ownerId: owner,
      durationMs: Date.now() - started,
      statusCode: error instanceof HttpError ? error.status : 500,
    });
    throw error;
  }
}

/** Plan, consent, provider, ownership and revision: checked before any provider call. */
async function preparePlanned(
  owner: string,
  allowed: (plan: Awaited<ReturnType<typeof getUserSubscription>>["plan"]) => boolean,
  refusal: string,
  documentId: string,
  revision: number,
) {
  const { plan } = await getUserSubscription(owner);
  if (!allowed(plan)) throw new HttpError(402, "PLAN_REQUIRED", refusal);
  await requireAiConsent(owner);
  if (!openAIConfigured())
    throw new HttpError(503, "AI_NOT_CONFIGURED", "OpenAI is not configured on this installation yet.");
  const doc = await getResume(owner, documentId);
  if (doc.revision !== revision) throw conflict();
  return { plan, doc };
}

/** Runs one counted AI request with metadata-only logging. */
async function counted<T>(
  owner: string,
  plan: { aiRequestsPerDay: number; name: string },
  doc: { id: string; revision: number },
  event: string,
  promptVersion: string,
  work: () => Promise<T>,
  metadata: (result: T) => Record<string, number> = () => ({}),
) {
  await reserveDailyRequest(owner, plan.aiRequestsPerDay, plan.name);
  const started = Date.now();
  try {
    const result = await work();
    logOperation({
      level: "info",
      event: `${event}_generated`,
      ownerId: owner,
      documentId: doc.id,
      revision: doc.revision,
      durationMs: Date.now() - started,
      statusCode: 200,
      metadata: { model: openAIModel(), promptVersion, ...metadata(result) },
    });
    return result;
  } catch (error) {
    logOperation({
      level: "warn",
      event: `${event}_failed`,
      ownerId: owner,
      documentId: doc.id,
      revision: doc.revision,
      durationMs: Date.now() - started,
      statusCode: error instanceof HttpError ? error.status : 500,
    });
    throw error;
  }
}

/** Match a job post with AI (Go and Pro): requirements, shown evidence and gaps. */
export async function requestJobMatch(
  owner: string,
  input: JobMatchRequest,
  generator: (
    doc: Awaited<ReturnType<typeof getResume>>,
    job: JobMatchRequest["job"],
  ) => ReturnType<typeof generateJobMatch> = generateJobMatch,
): Promise<JobMatchResult> {
  input = jobMatchRequestSchema.parse(input);
  const { plan, doc } = await preparePlanned(
    owner,
    (p) => p.aiJobMatch,
    "Matching a job post with AI is part of Go and Pro. The built-in comparison works on every plan.",
    input.documentId,
    input.revision,
  );
  const result = await counted(
    owner,
    plan,
    doc,
    "ai_job_match",
    JOB_MATCH_PROMPT_VERSION,
    () => generator(doc, input.job),
    (r) => ({
      requirementCount: r.requirements.length,
      shownCount: r.requirements.filter((x) => x.status === "shown").length,
      withheldCount: r.withheld,
    }),
  );
  return { requestId: input.requestId, ...result };
}

/** A gap the person has: their one line becomes a bullet or skill to review. */
export async function requestGapLine(
  owner: string,
  input: GapLineRequest,
  generator: (
    doc: Awaited<ReturnType<typeof getResume>>,
    input: GapLineRequest,
  ) => ReturnType<typeof generateGapLine> = generateGapLine,
): Promise<GapLineResult> {
  input = gapLineRequestSchema.parse(input);
  const { plan, doc } = await preparePlanned(
    owner,
    (p) => p.aiJobMatch,
    "Matching a job post with AI is part of Go and Pro.",
    input.documentId,
    input.revision,
  );
  const result = await counted(owner, plan, doc, "ai_gap_line", GAP_LINE_PROMPT_VERSION, () =>
    generator(doc, input),
  );
  return { requestId: input.requestId, ...result };
}

/** Tailor with AI (Pro): reviewed wording saved by the editor as a tailored copy. */
export async function requestTailoring(
  owner: string,
  input: TailorRequest,
  generator: (
    doc: Awaited<ReturnType<typeof getResume>>,
    input: TailorRequest,
  ) => ReturnType<typeof generateTailoring> = generateTailoring,
): Promise<TailorResult> {
  input = tailorRequestSchema.parse(input);
  const { plan, doc } = await preparePlanned(
    owner,
    (p) => p.aiTailor,
    "Tailoring your summary and bullets to a job with AI is part of Pro.",
    input.documentId,
    input.revision,
  );
  const result = await counted(
    owner,
    plan,
    doc,
    "ai_tailor",
    TAILOR_PROMPT_VERSION,
    () => generator(doc, input),
    (r) => ({ rewriteCount: r.rewrites.length, hasSummary: r.summary ? 1 : 0, withheldCount: r.withheld }),
  );
  return { requestId: input.requestId, ...result };
}

/** Write a cover letter with AI (Go and Pro). Nothing is saved here. */
export async function requestCoverLetter(
  owner: string,
  input: CoverLetterRequest,
  generator: (
    doc: Awaited<ReturnType<typeof getResume>>,
    input: CoverLetterRequest,
  ) => ReturnType<typeof generateCoverLetterDraft> = generateCoverLetterDraft,
): Promise<CoverLetterResult> {
  input = coverLetterRequestSchema.parse(input);
  const { plan, doc } = await preparePlanned(
    owner,
    (p) => p.aiCoverLetter,
    "Writing a cover letter with AI is part of Go and Pro.",
    input.documentId,
    input.revision,
  );
  const result = await counted(
    owner,
    plan,
    doc,
    "ai_cover_letter",
    COVER_LETTER_PROMPT_VERSION,
    () => generator(doc, input),
    (r) => ({ paragraphCount: r.paragraphs.length, withheldCount: r.withheld }),
  );
  return { requestId: input.requestId, ...result };
}

/**
 * Tidy with AI after an import (Go and Pro): structure-only operations on a
 * document that is not saved yet. Needs a signed-in account with AI writing
 * help on; counts as one AI request.
 */
export async function requestImportTidy(
  owner: string,
  input: ImportTidyRequest,
  generator: (doc: ImportTidyRequest["document"]) => ReturnType<typeof generateImportTidy> = generateImportTidy,
): Promise<ImportTidyResult> {
  input = importTidyRequestSchema.parse(input);
  const { plan } = await getUserSubscription(owner);
  if (!plan.aiImportTidy)
    throw new HttpError(402, "PLAN_REQUIRED", "Tidying an imported CV with AI is part of Go and Pro.");
  await requireAiConsent(owner);
  if (!openAIConfigured())
    throw new HttpError(503, "AI_NOT_CONFIGURED", "OpenAI is not configured on this installation yet.");
  const result = await counted(
    owner,
    plan,
    { id: input.document.id, revision: 0 },
    "ai_import_tidy",
    IMPORT_TIDY_PROMPT_VERSION,
    () => generator(input.document),
    (r) => ({ operationCount: r.ops.length, droppedCount: r.dropped }),
  );
  return { requestId: input.requestId, ...result };
}

/** Ask the AI (Go and Pro): one counted request per question; nothing is saved. */
export async function requestAsk(
  owner: string,
  input: AskRequest,
  generator: (
    doc: Awaited<ReturnType<typeof getResume>>,
    input: AskRequest,
  ) => ReturnType<typeof generateAsk> = generateAsk,
): Promise<AskResult> {
  input = askRequestSchema.parse(input);
  const { plan, doc } = await preparePlanned(
    owner,
    (p) => p.aiAsk,
    "Asking the AI about your CV is part of Go and Pro. Help me finish works on every plan.",
    input.documentId,
    input.revision,
  );
  const result = await counted(
    owner,
    plan,
    doc,
    "ai_ask",
    ASK_PROMPT_VERSION,
    () => generator(doc, input),
    (r) => ({ actionCount: r.actions.length, withheld: r.withheld ? 1 : 0 }),
  );
  return { requestId: input.requestId, ...result };
}
