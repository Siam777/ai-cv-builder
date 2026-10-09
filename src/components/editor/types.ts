import type { ResumeDocument, Entry, Bullet } from "@/lib/document";
import type { AccountUser } from "@/lib/cloud-contract";

export type SaveState =
  | "Loading"
  | "Saved on this device"
  | "Unsaved changes"
  | "Saving…"
  | "Save failed";

export type FocusTarget = {
  sectionId: string;
  entryId?: string;
  bulletId?: string;
  field?: string;
};

export interface EditorCommonProps {
  doc: ResumeDocument;
  busy: boolean;
  disabled?: boolean;
}
