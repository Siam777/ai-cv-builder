import type { ResumeDocument } from "./document";
import { addSkillToText } from "./skills-taxonomy";
import { discoverDemonstratedSkills } from "./vault/ai-assistant";

/** The kinds of field that have a sparkle (AI) menu. */
export type FieldKind = "bullet" | "summary" | "skills";

export type FieldActionId =
  | "improve"
  | "result"
  | "shorten"
  | "grammar"
  | "draft"
  | "ai-draft"
  | "skills"
  | "examples"
  | "ai-skills";

export interface FieldActionDef {
  id: FieldActionId;
  label: string;
  hint: string;
  /** "ai" actions send text to the AI provider; "local" ones run in the browser. */
  source: "ai" | "local";
}

const ACTIONS: Record<FieldActionId, FieldActionDef> = {
  improve: {
    id: "improve",
    label: "Improve wording",
    hint: "AI rewrite from your own words",
    source: "ai",
  },
  result: {
    id: "result",
    label: "Add a result (you type it)",
    hint: "Built-in: adds the result you type",
    source: "local",
  },
  shorten: {
    id: "shorten",
    label: "Shorten",
    hint: "AI trims it, keeping every fact",
    source: "ai",
  },
  grammar: {
    id: "grammar",
    label: "Fix grammar",
    hint: "Spacing, capitals and repeated words",
    source: "local",
  },
  "ai-draft": {
    id: "ai-draft",
    label: "Write with AI",
    hint: "AI drafts it from your CV; you review it",
    source: "ai",
  },
  draft: {
    id: "draft",
    label: "Quick draft",
    hint: "Built-in template from your CV details",
    source: "local",
  },
  skills: {
    id: "skills",
    label: "Add skills from my CV",
    hint: "Skills your bullets already show",
    source: "local",
  },
  "ai-skills": {
    id: "ai-skills",
    label: "Suggest skills with AI",
    hint: "Skills your CV shows, and common ones for your role",
    source: "ai",
  },
  examples: {
    id: "examples",
    label: "Show examples",
    hint: "AI examples for your job title, with blanks to fill",
    source: "ai",
  },
};

/** The sparkle menu for each kind of field, in the order shown. */
export function fieldActions(kind: FieldKind): FieldActionDef[] {
  const ids: FieldActionId[] =
    kind === "bullet"
      ? ["improve", "shorten", "result", "grammar"]
      : kind === "summary"
        ? ["ai-draft", "examples", "draft", "grammar"]
        : ["ai-skills", "examples", "skills"];
  return ids.map((id) => ACTIONS[id]);
}

export function fieldAction(id: FieldActionId): FieldActionDef {
  return ACTIONS[id];
}

/** What the AI is asked to do for each AI action. */
export const REWRITE_INSTRUCTIONS = {
  improve:
    "Make this bullet clearer and stronger in wording without adding or strengthening facts.",
  shorten:
    "Shorten this bullet while preserving every responsibility and fact.",
} as const;

export interface DiffPart {
  type: "same" | "del" | "ins";
  text: string;
}

const MAX_DIFF_CELLS = 250_000;

/** Word-level difference between two texts, for the inline accept/reject view. */
export function diffWords(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ type: "same", text: before }] : [];
  const a = before.match(/\s+|[^\s]+/g) ?? [];
  const b = after.match(/\s+|[^\s]+/g) ?? [];
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts.at(-1);
    if (last?.type === type) last.text += text;
    else parts.push({ type, text });
  };
  if (a.length * b.length > MAX_DIFF_CELLS) {
    if (before) push("del", before);
    if (after) push("ins", after);
    return parts;
  }
  // Longest common subsequence over words and whitespace.
  const table = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      push("del", a[i++]);
    } else {
      push("ins", b[j++]);
    }
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("ins", b[j++]);
  return parts;
}

/**
 * A conservative, deterministic tidy-up: spacing, punctuation spacing, the
 * pronoun "I", repeated words and the first capital. It never adds facts and
 * cannot catch every mistake, so the menu describes it narrowly.
 */
export function fixGrammar(text: string): string {
  let out = text
    .replace(/[ \t]+/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .replace(/([,;])(?=[A-Za-z])/g, "$1 ")
    .replace(/(^|[\s(])i(?=[\s,;!?']|$)/g, "$1I")
    .replace(/\b([A-Za-z]{2,})(\s+\1\b)+/gi, "$1")
    .trim();
  out = out.replace(/^[a-z]/, (letter) => letter.toUpperCase());
  return out;
}

/** The Skills text with every skill the bullets already show added to it. */
export function skillsProposal(
  doc: ResumeDocument,
  currentText: string,
): { text: string; skills: string[] } {
  const found = discoverDemonstratedSkills(doc);
  let text = currentText;
  const skills: string[] = [];
  for (const item of found) {
    const next = addSkillToText(text, item.skill);
    if (next !== text) {
      text = next;
      skills.push(item.skill);
    }
  }
  return { text, skills };
}
