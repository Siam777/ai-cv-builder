import { z } from "zod";
import { documentSchema } from "./document";

export const userSchema = z.object({
  id: z.string().min(1).max(128),
  email: z.string(),
});
export type AccountUser = z.infer<typeof userSchema>;
export const saveRequestSchema = z.strictObject({
  document: documentSchema,
  expectedRevision: z.number().int().nonnegative().nullable(),
});
export const deleteRequestSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
});
export const importRequestSchema = z
  .strictObject({ documents: z.array(documentSchema).min(1).max(20) })
  .refine(
    (value) =>
      new Set(value.documents.map((doc) => doc.id)).size ===
      value.documents.length,
    "Choose each local resume only once.",
  );
export const passwordSchema = z.string().min(12).max(128);
export const authRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("signin"),
    email: z.email().max(254),
    password: z.string().min(1).max(128),
  }),
  z.strictObject({
    action: z.literal("signup"),
    email: z.email().max(254),
    password: passwordSchema,
  }),
  z.strictObject({ action: z.literal("reset"), email: z.email().max(254) }),
  z.strictObject({ action: z.literal("signout") }),
]);
export const importReceiptSchema = z.object({
  source_id: z.string(),
  resume_id: z.string(),
  imported_at: z.string(),
});
export type ImportReceipt = z.infer<typeof importReceiptSchema>;
