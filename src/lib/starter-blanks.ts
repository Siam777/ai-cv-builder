import { starterReady } from "./ai-contract";

const BLANK = /\[([^[\]\n]{1,40})\]/g;

/** What the person has done to one example: filled or removed blanks, or rewritten it. */
export interface BlankState {
  template: string;
  fills: string[];
  removed: boolean[];
  /** The whole sentence, once the person chooses to edit it freely. */
  free?: string;
}

export function blankState(template: string): BlankState {
  const count = template.match(BLANK)?.length ?? 0;
  return { template, fills: Array(count).fill(""), removed: Array(count).fill(false) };
}

export type Part = { text: string } | { blank: string; index: number };
export function parts(template: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  let index = 0;
  for (const match of template.matchAll(BLANK)) {
    if (match.index! > last) out.push({ text: template.slice(last, match.index) });
    out.push({ blank: match[1], index: index++ });
    last = match.index! + match[0].length;
  }
  if (last < template.length) out.push({ text: template.slice(last) });
  return out;
}

const CONNECTOR = /\s+(?:for|to|with|using|on|in|of|by|and|at|across|from|via)\s*$/i;
/**
 * The template split into parts, with a linking word dropped when the blank
 * after it is removed and only punctuation (or nothing) follows, so removing
 * "[user group]" from "… for [user group]." does not leave "… for .".
 */
export function visibleParts(state: BlankState): Part[] {
  const all = parts(state.template);
  return all.map((part, i) => {
    if (!("text" in part)) return part;
    const next = all[i + 1];
    const after = all[i + 2];
    if (
      next &&
      "blank" in next &&
      state.removed[next.index] &&
      (!after || ("text" in after && /^\s*[,.;:!?]/.test(after.text)))
    )
      return { text: part.text.replace(CONNECTOR, "") };
    return part;
  });
}

/** The sentence as it reads now; unfilled blanks stay as [blank]. */
export function composeBlanks(state: BlankState) {
  if (state.free !== undefined) return state.free;
  const text = visibleParts(state)
    .map((part) =>
      "text" in part
        ? part.text
        : state.removed[part.index]
          ? ""
          : state.fills[part.index].trim() || `[${part.blank}]`,
    )
    .join("");
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();
}

export function blanksReady(state: BlankState) {
  return starterReady(composeBlanks(state));
}
