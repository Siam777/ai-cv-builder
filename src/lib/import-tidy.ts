import { z } from "zod";
import {
  labels,
  sectionTypes,
  uid,
  type ResumeDocument,
  type SectionType,
} from "./document";

/**
 * Tidy with AI after an import: structure only. The AI may move an entry to
 * another section, split a run-on bullet (same words, same order) and set
 * dates written in the entry itself. It can never change wording.
 */
export const importTidyDraftSchema = z.strictObject({
  moves: z
    .array(z.strictObject({ entryId: z.string().max(100), toType: z.string().max(30) }))
    .max(30),
  splits: z
    .array(
      z.strictObject({
        bulletId: z.string().max(100),
        parts: z.array(z.string().max(2000)).max(6),
      }),
    )
    .max(30),
  dates: z
    .array(
      z.strictObject({
        entryId: z.string().max(100),
        start: z.string().max(7),
        end: z.string().max(7),
        current: z.boolean(),
      }),
    )
    .max(50),
});
export type ImportTidyDraft = z.infer<typeof importTidyDraftSchema>;

export type TidyOperation =
  | { type: "move"; entryId: string; toType: SectionType }
  | { type: "split"; bulletId: string; parts: string[] }
  | { type: "dates"; entryId: string; start: string; end: string; current: boolean };

const tokens = (value: string) =>
  value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
/** True when two texts have exactly the same words in the same order. */
export function sameWords(a: string, b: string) {
  const x = tokens(a);
  const y = tokens(b);
  return x.length > 0 && x.length === y.length && x.every((word, i) => word === y[i]);
}

const MONTHS = [
  ["jan", "january"],
  ["feb", "february"],
  ["mar", "march"],
  ["apr", "april"],
  ["may", "may"],
  ["jun", "june"],
  ["jul", "july"],
  ["aug", "august"],
  ["sep", "september", "sept"],
  ["oct", "october"],
  ["nov", "november"],
  ["dec", "december"],
];
/** Keeps a YYYY or YYYY-MM date only as far as the entry's own text states it. */
export function statedDate(value: string, text: string) {
  const match = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(value.trim());
  if (!match) return "";
  const [, year, month] = match;
  if (!text.includes(year)) return "";
  if (!month) return year;
  const lower = text.toLowerCase();
  const names = MONTHS[Number(month) - 1];
  const named = names.some((name) => new RegExp(`\\b${name}\\b`).test(lower));
  const numeric = new RegExp(`\\b0?${Number(month)}\\s*[/.-]\\s*${year}\\b|\\b${year}\\s*[/.-]\\s*0?${Number(month)}\\b`).test(lower);
  return named || numeric ? `${year}-${month}` : year;
}

function entryText(entry: ResumeDocument["sections"][number]["entries"][number]) {
  return [
    entry.title,
    entry.organization,
    entry.location,
    entry.description,
    entry.start,
    entry.end,
    ...entry.bullets.map((b) => b.text),
  ].join(" \n ");
}

/** What may be sent: every section without contact details or photos. */
export function tidyInput(doc: ResumeDocument) {
  return doc.sections.map((section) => ({
    sectionId: section.id,
    type: section.type,
    label: section.label,
    entries: section.entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      organization: entry.organization,
      location: entry.location,
      start: entry.start,
      end: entry.end,
      current: entry.current,
      description: entry.description,
      bullets: entry.bullets.map((b) => ({ id: b.id, text: b.text })),
    })),
  }));
}

/**
 * Keeps only operations the document's own text supports: moves to a real
 * section type, splits with exactly the same words, dates stated in the
 * entry. Everything else is dropped and counted.
 */
export function validateTidy(doc: ResumeDocument, draft: ImportTidyDraft) {
  const ops: TidyOperation[] = [];
  let dropped = 0;
  const entries = new Map(
    doc.sections.flatMap((section) => section.entries.map((entry) => [entry.id, { entry, section }] as const)),
  );
  const bullets = new Map(
    doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => [b.id, b] as const))),
  );
  const moved = new Set<string>();
  for (const move of draft.moves) {
    const found = entries.get(move.entryId);
    const toType = move.toType as SectionType;
    if (
      !found ||
      moved.has(move.entryId) ||
      !sectionTypes.includes(toType) ||
      toType === "custom" ||
      toType === found.section.type
    ) {
      dropped++;
      continue;
    }
    moved.add(move.entryId);
    ops.push({ type: "move", entryId: move.entryId, toType });
  }
  const split = new Set<string>();
  for (const item of draft.splits) {
    const bullet = bullets.get(item.bulletId);
    const parts = item.parts.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!bullet || split.has(item.bulletId) || parts.length < 2 || !sameWords(bullet.text, parts.join(" "))) {
      dropped++;
      continue;
    }
    split.add(item.bulletId);
    ops.push({ type: "split", bulletId: item.bulletId, parts });
  }
  const dated = new Set<string>();
  for (const item of draft.dates) {
    const found = entries.get(item.entryId);
    if (!found || dated.has(item.entryId)) {
      dropped++;
      continue;
    }
    const text = entryText(found.entry);
    const stated = {
      start: statedDate(item.start, text),
      end: statedDate(item.end, text),
      current: item.current && /\b(present|current|currently|now|today)\b/i.test(text),
    };
    if (!stated.start && !stated.end && !stated.current) {
      dropped++;
      continue;
    }
    // A value the entry does not state keeps the entry's existing date.
    const start = stated.start || found.entry.start;
    const current = stated.current || (!stated.end && found.entry.current);
    const end = current ? "" : stated.end || found.entry.end;
    if (start === found.entry.start && end === found.entry.end && current === found.entry.current) continue;
    dated.add(item.entryId);
    ops.push({ type: "dates", entryId: item.entryId, start, end, current });
  }
  return { ops, dropped };
}

const label = (entry: { title: string; organization: string }) =>
  [entry.title.trim(), entry.organization.trim()].filter(Boolean).join(" at ") || "an entry";

/** Applies checked operations and lists, in plain words, what moved. */
export function applyTidy(doc: ResumeDocument, ops: TidyOperation[]) {
  const next = structuredClone(doc);
  const changes: string[] = [];
  for (const op of ops) {
    if (op.type === "move") {
      const from = next.sections.find((s) => s.entries.some((e) => e.id === op.entryId));
      if (!from) continue;
      const entry = from.entries.find((e) => e.id === op.entryId)!;
      let to = next.sections.find((s) => s.type === op.toType);
      if (!to) {
        to = { id: uid(), type: op.toType, label: labels[op.toType], visible: true, entries: [] };
        next.sections.push(to);
      }
      from.entries = from.entries.filter((e) => e.id !== op.entryId);
      to.entries.push(entry);
      changes.push(`Moved “${label(entry)}” from ${from.label || labels[from.type]} to ${to.label || labels[to.type]}.`);
    } else if (op.type === "split") {
      for (const entry of next.sections.flatMap((s) => s.entries)) {
        const index = entry.bullets.findIndex((b) => b.id === op.bulletId);
        if (index < 0) continue;
        entry.bullets.splice(
          index,
          1,
          ...op.parts.map((text, i) => ({ id: i === 0 ? op.bulletId : uid(), text })),
        );
        changes.push(`Split a long bullet in “${label(entry)}” into ${op.parts.length}.`);
      }
    } else {
      const entry = next.sections.flatMap((s) => s.entries).find((e) => e.id === op.entryId);
      if (!entry) continue;
      entry.start = op.start;
      entry.end = op.end;
      entry.current = op.current;
      changes.push(
        `Set the dates of “${label(entry)}”: ${op.start || "no start"} to ${op.current ? "present" : op.end || "no end"}.`,
      );
    }
  }
  return { document: next, changes };
}
