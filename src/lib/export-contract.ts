import { z } from "zod";
import { documentSchema } from "./document";

export const exportSourceSchema = z.discriminatedUnion("storage", [
  z.strictObject({
    storage: z.literal("account"),
    documentId: z.string().min(1).max(100),
    revision: z.number().int().nonnegative(),
  }),
  z.strictObject({
    storage: z.literal("device"),
    document: documentSchema,
    processingConsent: z.literal(true),
  }),
  // A copy frozen in the application tracker, read from the owner's account.
  z.strictObject({
    storage: z.literal("frozen"),
    applicationId: z.string().min(1).max(100),
    documentId: z.string().min(1).max(100),
  }),
]);
export const exportRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("resume"),
    source: exportSourceSchema,
    format: z.enum(["pdf", "docx", "html", "md", "txt", "json", "print"]),
  }),
  z.strictObject({
    kind: z.literal("letter"),
    source: exportSourceSchema,
    format: z.enum(["txt", "md", "copy", "print"]),
    text: z.string().min(1).max(20000),
    name: z.string().min(1).max(200),
  }),
]);
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ExportSource = z.infer<typeof exportSourceSchema>;
