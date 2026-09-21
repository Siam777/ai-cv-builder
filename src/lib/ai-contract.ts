import { z } from "zod";
import { type ResumeDocument } from "./document";
import { bulletEvidence } from "./ai-proposals";

export const generateSchema = z.strictObject({
  requestId: z.uuid(),
  documentId: z.string().min(1).max(100),
  revision: z.number().int().nonnegative(),
  bulletId: z.string().min(1).max(100),
  instruction: z.string().trim().min(1).max(1000),
  consent: z.literal(true),
});
export type GenerateRequest = z.infer<typeof generateSchema>;
export const draftSchema = z.strictObject({
  message: z.string().max(1500),
  questions: z.array(z.string().max(400)).max(3),
  text: z.string().max(3000),
  evidenceIds: z.array(z.string().max(100)).max(10),
});
export const supportSchema = z.strictObject({
  supported: z.boolean(),
  reason: z.string().max(1000),
});
export const decisionSchema = z.strictObject({
  decision: z.enum(["accept", "reject"]),
  confirmed: z.literal(true),
});

export function rewriteContext(doc: ResumeDocument, bulletId: string) {
  const all = bulletEvidence(doc);
  const selected = all.find((item) => item.id === bulletId);
  if (!selected)
    throw new Error("Choose a nonempty bullet from the active resume.");
  const sources = all.filter(
    (item) =>
      item.entryId === selected.entryId &&
      item.sectionId === selected.sectionId,
  );
  if (
    sources.length > 10 ||
    sources.reduce((size, source) => size + source.text.length, 0) > 12000
  )
    throw new Error(
      "This entry is too large for a rewrite. Use no more than 10 bullets and 12,000 characters.",
    );
  return { selected, sources };
}
// Defense in depth only. Semantic support is checked separately, then reviewed by the user.
export function hasNewNumbers(text: string, evidence: string[]) {
  const numbers = (value: string) =>
    value.normalize("NFKC").match(/\p{N}+(?:[.,]\p{N}+)*(?:\s*[%％])?/gu) ?? [];
  const existing = new Set(
    evidence.flatMap(numbers).map((n) => n.replace(/\s/g, "")),
  );
  return numbers(text).some((n) => !existing.has(n.replace(/\s/g, "")));
}
