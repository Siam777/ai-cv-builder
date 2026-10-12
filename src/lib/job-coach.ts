import { z } from "zod";
import { type ResumeDocument } from "./document";
import {
  draftSchema,
  supportSchema,
  rewriteContext,
  hasNewNumbers,
} from "./ai-contract";
import { proposalSchema, reviewProposal } from "./ai-proposals";
import {
  assessmentSchema,
  type JobCoachContext,
  type JobCoachInput,
} from "./job-coach-contract";
import { type JobEvidenceReview } from "./vault/job-evidence";
export const JOB_COACH_PROMPT_VERSION = "job-criterion-coach-v1";
export const jobCoachingDraftSchema = draftSchema.extend({
  assessment: assessmentSchema,
});

export function coachingInput(
  review: JobEvidenceReview,
  criterionId: string,
): JobCoachInput {
  const criterion = review.matches.find(
    (match) => match.criterion.id === criterionId,
  )?.criterion;
  if (!criterion)
    throw new Error("Choose a criterion in the current posting review.");
  return {
    jobText: review.jobText,
    criterionId,
    priority: criterion.priority,
    priorityOrigin: criterion.priorityOrigin,
    target: review.target,
    sourceHash: review.sourceHash,
    jobHash: review.jobHash,
    rulesVersion: review.version,
    termsVersion: review.termsVersion,
  };
}

/** Local boundary for independently audited model replies. No network calls.
 * Verdicts must be obtained by the server, never accepted from a browser.
 */
export function createCoachingProposal(input: {
  doc: ResumeDocument;
  requestId: string;
  bulletId: string;
  job: JobCoachContext;
  draft: unknown;
  assessmentSupport: z.infer<typeof supportSchema> | null;
  rewriteSupport: z.infer<typeof supportSchema> | null;
  model: string;
  analyzedAt: string;
}) {
  const { doc, job } = input;
  const context = rewriteContext(doc, input.bulletId);
  if (
    !doc.sections.find((section) => section.id === context.selected.sectionId)
      ?.visible
  )
    throw new Error("Choose a visible bullet for coaching.");
  const draft = jobCoachingDraftSchema.parse(input.draft);
  const resolve = (ids: string[]) => {
    if (new Set(ids).size !== ids.length)
      throw new Error("Duplicate coaching citation.");
    return ids.map((id) => {
      const source = context.sources.find((source) => source.id === id);
      if (!source)
        throw new Error(
          "Coaching citations must belong to the selected entry.",
        );
      return source;
    });
  };
  resolve(draft.assessment.evidenceIds);
  const sources = resolve(draft.evidenceIds);
  if (
    draft.assessment.status === "relevant" &&
    !draft.assessment.evidenceIds.length
  )
    throw new Error("A relevance assessment needs candidate citations.");
  const assessmentAccepted =
    input.assessmentSupport !== null &&
    supportSchema.parse(input.assessmentSupport).supported;
  const rewriteAccepted =
    input.rewriteSupport !== null &&
    supportSchema.parse(input.rewriteSupport).supported;
  const unsafeAssessment =
    !assessmentAccepted ||
    job.target.language !== "english" ||
    job.criterion.minimumYears !== null ||
    hasNewNumbers(
      [draft.message, draft.assessment.explanation, ...draft.questions].join(
        " ",
      ),
      [
        ...context.sources.map((source) => source.text),
        job.criterion.description,
      ],
    );
  const wantsEdit =
    draft.assessment.status === "relevant" && !!draft.text.trim();
  const unsafeRewrite =
    wantsEdit &&
    (!sources.length ||
      !rewriteAccepted ||
      hasNewNumbers(
        draft.text,
        sources.map((source) => source.text),
      ));
  const withheld = unsafeAssessment || unsafeRewrite;
  const proposal = proposalSchema.parse({
    schemaVersion: 1,
    id: input.requestId,
    documentId: doc.id,
    baseRevision: doc.revision,
    message: withheld
      ? "The suggested interpretation or wording was withheld. Review the original evidence manually."
      : draft.message,
    questions: withheld
      ? [
          "What experience can you document for this criterion? Add confirmed facts to your CV before trying again.",
        ]
      : draft.questions,
    coaching: {
      ...job,
      promptVersion: JOB_COACH_PROMPT_VERSION,
      model: input.model,
      analyzedAt: input.analyzedAt,
      selectedBulletId: input.bulletId,
      sources: context.sources,
      assessment: withheld
        ? {
            status: "uncertain",
            explanation:
              "Candidate evidence did not establish this suggestion. No duration, qualification or outcome was inferred.",
            evidenceIds: [],
          }
        : draft.assessment,
    },
    operations:
      wantsEdit && !withheld
        ? [
            {
              type: "replaceBullet",
              sectionId: context.selected.sectionId,
              entryId: context.selected.entryId,
              bulletId: context.selected.id,
              before: context.selected.text,
              text: draft.text,
              evidenceIds: draft.evidenceIds,
            },
          ]
        : [],
  });
  return reviewProposal(doc, proposal).proposal;
}
