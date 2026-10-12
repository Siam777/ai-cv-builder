import { createHash } from "node:crypto";
import { z } from "zod";
import { createDocument, newEntry } from "../../src/lib/document";
import {
  coachingInput,
  createCoachingProposal,
  JOB_COACH_PROMPT_VERSION,
} from "../../src/lib/job-coach";
import { jobCoachContext } from "../../src/lib/server/job-coach-context";
import {
  generateJobCoaching,
  openAIModel,
  JOB_GENERATION_PROMPT,
  JOB_SUPPORT_PROMPT,
  SUPPORT_PROMPT,
} from "../../src/lib/server/openai-provider";
import {
  reviewJobEvidence,
  JOB_EVIDENCE_VERSION,
  JOB_TERMS_VERSION,
} from "../../src/lib/vault/job-evidence";
import { reviewTargetSchema } from "../../src/lib/job-review-history";
import { HttpError } from "../../src/lib/server/http";

export const EVALUATION_VERSION = "job-coaching-evaluation-v1";
export const corpusSchema = z
  .strictObject({
    version: z.string().min(1).max(100),
    split: z.literal("development"),
    provenance: z.literal("agent-authored-synthetic"),
    cases: z
      .array(
        z.strictObject({
          id: z
            .string()
            .regex(/^[a-z0-9-]+$/)
            .max(100),
          group: z.enum([
            "technology",
            "data",
            "design-marketing",
            "operations",
            "people-customer",
            "early-career",
          ]),
          target: reviewTargetSchema,
          bullets: z.array(z.string().min(1).max(2000)).min(1).max(10),
          posting: z.string().min(1).max(20000),
          instruction: z.string().min(1).max(1000),
          expected: z.strictObject({
            statuses: z
              .array(z.enum(["relevant", "uncertain", "not_demonstrated"]))
              .min(1)
              .max(3),
            allowEdit: z.boolean(),
            abstentionCode: z.enum(["AI_JOB_LANGUAGE"]).nullable(),
            forbiddenEditPatterns: z.array(z.string().min(1).max(300)).max(10),
            rationale: z.string().min(1).max(1000),
          }),
        }),
      )
      .min(1)
      .max(120),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.cases.map((row) => row.id)).size !== value.cases.length)
      ctx.addIssue({ code: "custom", message: "Duplicate evaluation case ID" });
    for (const row of value.cases)
      for (const pattern of row.expected.forbiddenEditPatterns)
        try {
          new RegExp(pattern, "iu");
        } catch {
          ctx.addIssue({
            code: "custom",
            message: `Invalid pattern in ${row.id}`,
          });
        }
  });
export type EvaluationCase = z.infer<typeof corpusSchema>["cases"][number];
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function prepareCase(row: EvaluationCase) {
  const doc = createDocument();
  doc.id = `evaluation-${row.id}`;
  doc.contact.name = "Fictional evaluation candidate";
  doc.contact.email = "evaluation-contact-sentinel@example.test";
  const section = doc.sections.find(
    (section) => section.type === "experience",
  )!;
  section.entries = [
    {
      ...newEntry(),
      id: "evaluation-entry",
      title: row.target.role,
      bullets: row.bullets.map((text, index) => ({
        id: `source-${index}`,
        text,
      })),
    },
  ];
  const review = await reviewJobEvidence(doc, row.posting, row.target);
  if (row.target.language !== "english") {
    // Exercise the actual server language gate even when local extraction abstains.
    await jobCoachContext(doc, "source-0", {
      jobText: row.posting,
      criterionId: "language-abstention",
      priority: "uncertain",
      priorityOrigin: "posting",
      target: row.target,
      sourceHash: review.sourceHash,
      jobHash: review.jobHash,
      rulesVersion: review.version,
      termsVersion: review.termsVersion,
    });
  }
  if (!review.matches.length)
    throw new Error("Fixture must have at least one criterion");
  const job = await jobCoachContext(
    doc,
    "source-0",
    coachingInput(review, review.matches[0].criterion.id),
  );
  return { doc, job };
}

export type CaseResult = {
  id: string;
  group: EvaluationCase["group"];
  outcome:
    | "checks-passed"
    | "checks-failed"
    | "expected-abstention"
    | "provider-or-validation-failure";
  providerCalls: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  providerModels: string[];
  httpStatuses: number[];
  errorCode?: string;
  raw?: Awaited<ReturnType<typeof generateJobCoaching>>["draft"];
  audits?: { assessment: boolean; rewrite: boolean | null };
  final?: {
    status: string;
    message: string;
    explanation: string;
    questions: string[];
    text: string;
    evidenceIds: string[];
  };
  checks?: {
    assessmentAgreement: boolean;
    rawAssessmentAgreement: boolean;
    editPolicy: boolean;
    forbiddenClaimsAbsent: boolean;
    sourceUnchanged: boolean;
  };
  humanReview: "pending";
};

// Only synthetic fixtures enter this harness. No account database is imported or written.
export async function evaluateCase(
  row: EvaluationCase,
  transport: typeof fetch = fetch,
): Promise<CaseResult> {
  const started = Date.now();
  const result: CaseResult = {
    id: row.id,
    group: row.group,
    outcome: "provider-or-validation-failure",
    providerCalls: 0,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    providerModels: [],
    httpStatuses: [],
    humanReview: "pending",
  };
  try {
    const { doc, job } = await prepareCase(row);
    const snapshot = JSON.stringify(doc);
    const counted: typeof fetch = async (url, options) => {
      if (
        url !== "https://api.openai.com/v1/responses" ||
        result.providerCalls >= 3
      )
        throw new Error("Evaluation transport boundary exceeded");
      const request = JSON.parse(String(options?.body));
      if (
        request.store !== false ||
        request.max_output_tokens !== 1800 ||
        request.tools
      )
        throw new Error("Evaluation provider policy changed");
      result.providerCalls++;
      const response = await transport(url, options);
      result.httpStatuses.push(response.status);
      if (!response.ok) return response;
      // Read at most the production adapter's 100 KB limit, including usage metadata.
      const reader = response.body?.getReader();
      if (!reader) return response;
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 100000) {
            await reader.cancel();
            throw new Error("Oversized provider response");
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        const body = JSON.parse(raw);
        const usage = body.usage;
        if (
          Number.isSafeInteger(usage?.input_tokens) &&
          usage.input_tokens >= 0
        )
          result.inputTokens += usage.input_tokens;
        if (
          Number.isSafeInteger(usage?.output_tokens) &&
          usage.output_tokens >= 0
        )
          result.outputTokens += usage.output_tokens;
        if (
          typeof body.model === "string" &&
          body.model.length <= 200 &&
          !result.providerModels.includes(body.model)
        )
          result.providerModels.push(body.model);
      } catch {
        /* The production adapter owns JSON validation. Never persist raw response bodies. */
      }
      return new Response(raw, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    };
    const generated = await generateJobCoaching(
      doc,
      "source-0",
      row.instruction,
      job,
      counted,
    );
    const proposal = createCoachingProposal({
      doc,
      job,
      requestId: `eval-${row.id}`,
      bulletId: "source-0",
      ...generated,
      model: openAIModel(),
      analyzedAt: new Date().toISOString(),
    });
    const text = proposal.operations
      .map((operation) => operation.text)
      .join("\n");
    result.raw = generated.draft;
    result.audits = {
      assessment: generated.assessmentSupport.supported,
      rewrite: generated.rewriteSupport?.supported ?? null,
    };
    result.final = {
      status: proposal.coaching!.assessment.status,
      message: proposal.message,
      explanation: proposal.coaching!.assessment.explanation,
      questions: proposal.questions,
      text,
      evidenceIds: proposal.operations.flatMap(
        (operation) => operation.evidenceIds,
      ),
    };
    result.checks = {
      // Measure final displayed behavior; preserve raw output so audits cannot hide raw failures.
      assessmentAgreement: row.expected.statuses.includes(
        proposal.coaching!.assessment.status,
      ),
      rawAssessmentAgreement: row.expected.statuses.includes(
        generated.draft.assessment.status,
      ),
      editPolicy: row.expected.allowEdit || proposal.operations.length === 0,
      forbiddenClaimsAbsent: row.expected.forbiddenEditPatterns.every(
        (pattern) => !new RegExp(pattern, "iu").test(text),
      ),
      sourceUnchanged: JSON.stringify(doc) === snapshot,
    };
    result.outcome = Object.values(result.checks).every(Boolean)
      ? "checks-passed"
      : "checks-failed";
  } catch (error) {
    result.errorCode =
      error instanceof HttpError ? error.code : "EVALUATION_VALIDATION";
    if (result.httpStatuses.some((status) => status === 401 || status === 403))
      result.errorCode = "AI_PROVIDER_AUTH";
    if (
      row.expected.abstentionCode &&
      result.errorCode === row.expected.abstentionCode &&
      result.providerCalls === 0
    )
      result.outcome = "expected-abstention";
  }
  result.durationMs = Date.now() - started;
  return result;
}

export function evaluationSummary(results: CaseResult[]) {
  const completed = results.filter((row) => row.final);
  const latencies = completed
    .map((row) => row.durationMs)
    .sort((a, b) => a - b);
  return {
    attempted: results.length,
    modelResponses: completed.length,
    checksPassed: results.filter((row) => row.outcome === "checks-passed")
      .length,
    checksFailed: results.filter((row) => row.outcome === "checks-failed")
      .length,
    expectedAbstentions: results.filter(
      (row) => row.outcome === "expected-abstention",
    ).length,
    errors: results.filter(
      (row) => row.outcome === "provider-or-validation-failure",
    ).length,
    finalAssessmentAgreement: {
      numerator: completed.filter((row) => row.checks!.assessmentAgreement)
        .length,
      denominator: completed.length,
    },
    rawAssessmentAgreement: {
      numerator: completed.filter((row) => row.checks!.rawAssessmentAgreement)
        .length,
      denominator: completed.length,
    },
    applicableEdits: completed.filter((row) => row.final!.text).length,
    providerCalls: results.reduce((sum, row) => sum + row.providerCalls, 0),
    inputTokens: results.reduce((sum, row) => sum + row.inputTokens, 0),
    outputTokens: results.reduce((sum, row) => sum + row.outputTokens, 0),
    p95Ms: latencies.length
      ? latencies[Math.ceil(latencies.length * 0.95) - 1]
      : null,
    byGroup: Object.fromEntries(
      [...new Set(results.map((row) => row.group))].map((group) => {
        const rows = results.filter((row) => row.group === group);
        return [
          group,
          {
            attempted: rows.length,
            passed: rows.filter((row) => row.outcome === "checks-passed")
              .length,
            errors: rows.filter(
              (row) => row.outcome === "provider-or-validation-failure",
            ).length,
          },
        ];
      }),
    ),
    semanticSupport: "pending independent human review",
    releaseGatePassed: false,
  };
}

export function evaluationIdentity(corpus: z.infer<typeof corpusSchema>) {
  return {
    harnessVersion: EVALUATION_VERSION,
    corpusVersion: corpus.version,
    corpusHash: fingerprint(corpus),
    split: corpus.split,
    provenance: corpus.provenance,
    promptVersion: JOB_COACH_PROMPT_VERSION,
    promptHash: fingerprint([
      JOB_GENERATION_PROMPT,
      JOB_SUPPORT_PROMPT,
      SUPPORT_PROMPT,
    ]),
    rulesVersion: JOB_EVIDENCE_VERSION,
    termsVersion: JOB_TERMS_VERSION,
    configuredModel: openAIModel(),
  };
}
