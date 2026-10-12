import { type ResumeDocument } from "../document";
import { rewriteContext } from "../ai-contract";
import {
  type JobCoachInput,
  type JobCoachContext,
} from "../job-coach-contract";
import {
  reviewJobEvidence,
  JOB_EVIDENCE_VERSION,
  JOB_TERMS_VERSION,
} from "../vault/job-evidence";
import { HttpError } from "./http";
export async function jobCoachContext(
  doc: ResumeDocument,
  bulletId: string,
  input: JobCoachInput,
): Promise<JobCoachContext> {
  if (input.target.language !== "english")
    throw new HttpError(
      400,
      "AI_JOB_LANGUAGE",
      "This coaching slice supports English only. Keep this criterion in manual review.",
    );
  if (
    input.rulesVersion !== JOB_EVIDENCE_VERSION ||
    input.termsVersion !== JOB_TERMS_VERSION
  )
    throw new HttpError(
      409,
      "AI_JOB_RULES",
      "Review rules changed. Analyze the posting again.",
    );
  const context = rewriteContext(doc, bulletId);
  if (
    !doc.sections.find((section) => section.id === context.selected.sectionId)
      ?.visible
  )
    throw new HttpError(
      400,
      "AI_JOB_CONTEXT",
      "Choose a bullet in a visible section.",
    );
  let review;
  try {
    review = await reviewJobEvidence(doc, input.jobText, input.target);
  } catch (error) {
    throw new HttpError(400, "AI_JOB_CONTEXT", (error as Error).message);
  }
  if (
    review.sourceHash !== input.sourceHash ||
    review.jobHash !== input.jobHash
  )
    throw new HttpError(
      409,
      "AI_JOB_STALE",
      "The posting or CV changed. Analyze the current saved CV again.",
    );
  const found = review.matches.find(
    (match) => match.criterion.id === input.criterionId,
  );
  if (!found)
    throw new HttpError(
      400,
      "AI_JOB_CRITERION",
      "Choose a criterion from this posting review.",
    );
  if (
    input.priorityOrigin === "posting" &&
    input.priority !== found.criterion.priority
  )
    throw new HttpError(
      400,
      "AI_JOB_PRIORITY",
      "A changed priority must be marked as your reviewed choice.",
    );
  return {
    criterion: {
      ...found.criterion,
      priority: input.priority,
      priorityOrigin: input.priorityOrigin,
    },
    target: review.target,
    sourceHash: review.sourceHash,
    jobHash: review.jobHash,
    rulesVersion: review.version,
    termsVersion: review.termsVersion,
  };
}
