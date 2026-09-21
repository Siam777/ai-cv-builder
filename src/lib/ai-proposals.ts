import { z } from "zod";
import { documentSchema, type ResumeDocument } from "./document";

const id = z.string().min(1).max(100);
export const proposalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id,
  documentId: id,
  baseRevision: z.number().int().nonnegative(),
  message: z.string().max(2000),
  questions: z.array(z.string().min(1).max(500)).max(5),
  operations: z
    .array(
      z.strictObject({
        type: z.literal("replaceBullet"),
        sectionId: id,
        entryId: id,
        bulletId: id,
        before: z.string().max(20000),
        text: z.string().min(1).max(20000),
        evidenceIds: z.array(id).min(1).max(10),
      }),
    )
    .max(10),
});
export type Proposal = z.infer<typeof proposalSchema>;
export type Evidence = {
  id: string;
  sectionId: string;
  entryId: string;
  text: string;
};

// Evidence references resolve against the document snapshot, never provider text.
// This is a structural boundary, not a semantic fact checker or an authorization layer.
export function bulletEvidence(doc: ResumeDocument): Evidence[] {
  return doc.sections.flatMap((section) =>
    section.entries.flatMap((entry) =>
      entry.bullets
        .filter((bullet) => bullet.text.trim())
        .map((bullet) => ({
          id: bullet.id,
          sectionId: section.id,
          entryId: entry.id,
          text: bullet.text,
        })),
    ),
  );
}

export function reviewProposal(doc: ResumeDocument, input: unknown) {
  const proposal = proposalSchema.parse(input);
  if (proposal.documentId !== doc.id)
    throw new Error("The proposal belongs to another resume.");
  if (proposal.baseRevision !== doc.revision)
    throw new Error("The resume changed. Generate a new proposal.");
  const evidence = new Map(bulletEvidence(doc).map((fact) => [fact.id, fact]));
  const targets = new Set<string>();
  const changes = proposal.operations.map((operation) => {
    if (targets.has(operation.bulletId))
      throw new Error("A proposal cannot edit the same bullet twice.");
    targets.add(operation.bulletId);
    const bullet = doc.sections
      .find((s) => s.id === operation.sectionId)
      ?.entries.find((e) => e.id === operation.entryId)
      ?.bullets.find((b) => b.id === operation.bulletId);
    if (!bullet || bullet.text !== operation.before)
      throw new Error("The target bullet changed or no longer exists.");
    if (new Set(operation.evidenceIds).size !== operation.evidenceIds.length)
      throw new Error("Duplicate evidence reference.");
    const sources = operation.evidenceIds.map((evidenceId) => {
      const source = evidence.get(evidenceId);
      if (
        !source ||
        source.sectionId !== operation.sectionId ||
        source.entryId !== operation.entryId
      )
        throw new Error("Evidence must come from the same resume entry.");
      return source;
    });
    return { ...operation, sources };
  });
  return { proposal, changes };
}

/** Call only after authorization, factual-support review and explicit acceptance.
 * The caller must persist the result and receipt atomically with a revision check.
 * Does not mutate the input, persist, or claim evidence proves generated wording.
 */
export function applyReviewedProposal(
  doc: ResumeDocument,
  input: unknown,
  appliedIds: ReadonlySet<string>,
) {
  const { proposal, changes } = reviewProposal(doc, input);
  if (appliedIds.has(proposal.id))
    throw new Error("This proposal has already been applied.");
  if (!changes.length)
    throw new Error("There are no proposed edits to accept.");
  const next = structuredClone(doc);
  for (const change of changes) {
    const bullet = next.sections
      .find((s) => s.id === change.sectionId)!
      .entries.find((e) => e.id === change.entryId)!
      .bullets.find((b) => b.id === change.bulletId)!;
    bullet.text = change.text;
  }
  return { document: documentSchema.parse(next), receipt: proposal.id };
}
