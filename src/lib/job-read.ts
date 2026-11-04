/**
 * Reading a pasted job post (job capture phase B): shared, pure rules used by
 * the free local reader in the browser and by the server checks on Read with
 * AI. Nothing here calls a network service.
 *
 * Every value shown to the person comes with the words of the post it was
 * read from (its quote). A value without a supporting quote is never shown.
 */

/** The post limit, counted in characters (code points), not bytes or UTF-16 units. */
export const JOB_POST_MAX = 30000;
export const JOB_POST_MESSAGE = `The job post can be at most ${JOB_POST_MAX.toLocaleString("en-US")} characters. Shorten it and try again.`;
export const REQUIREMENT_MAX = 40;
export const REQUIREMENT_TEXT_MAX = 300;
/** Match a job takes at most 15 requirements; the rest stay on the application. */
export const MATCH_REQUIREMENT_MAX = 15;
/** The matcher still reads only the first 12,000 characters of a post. */
export const MATCH_POST_MAX = 12000;

export const charCount = (text: string) => [...text].length;
export const sliceChars = (text: string, max: number) => [...text].slice(0, max).join("");

export const JOB_FIELDS = [
  "role",
  "company",
  "location",
  "workType",
  "employmentType",
  "salary",
  "deadline",
  "applyLink",
] as const;
export type JobField = (typeof JOB_FIELDS)[number];
export const JOB_FIELD_LABELS: Record<JobField, string> = {
  role: "Role",
  company: "Company",
  location: "Location",
  workType: "Work type",
  employmentType: "Employment type",
  salary: "Salary as written",
  deadline: "Deadline",
  applyLink: "Apply link",
};
/** Fields copied from the post: the value must be the quote or a part of it. */
export const COPIED_FIELDS = ["role", "company", "location", "salary", "applyLink"] as const;
export const FIELD_MAX: Record<JobField, number> = {
  role: 200,
  company: 200,
  location: 200,
  workType: 20,
  employmentType: 20,
  salary: 200,
  deadline: 10,
  applyLink: 2000,
};

/** The fixed tables: a value is kept only when one of its source words is in the quote. */
export const WORK_TYPES: Record<string, string[]> = {
  "on-site": ["on-site", "onsite", "on site", "in-office", "in office", "office-based", "office based"],
  hybrid: ["hybrid"],
  remote: ["remote", "work from home", "working from home", "fully remote", "remote-first", "remote first"],
};
export const EMPLOYMENT_TYPES: Record<string, string[]> = {
  "full-time": ["full-time", "full time", "fulltime", "vollzeit", "tiempo completo", "temps plein"],
  "part-time": ["part-time", "part time", "parttime", "teilzeit", "medio tiempo", "temps partiel"],
  contract: ["contract", "contractor", "fixed-term", "fixed term", "befristet"],
  temporary: ["temporary", "temp role", "seasonal"],
  internship: ["internship", "intern", "praktikum", "prácticas", "stage"],
  freelance: ["freelance", "freelancer"],
  permanent: ["permanent", "unbefristet", "indefinido"],
};
export const WORK_TYPE_LABELS: Record<string, string> = {
  "on-site": "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};
export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  temporary: "Temporary",
  internship: "Internship",
  freelance: "Freelance",
  permanent: "Permanent",
};

export type RequirementKind = "must" | "nice" | "unstated";
export interface ReadField {
  value: string;
  /** The words of the post this value was read from. */
  quote: string;
}
export interface ReadRequirement {
  id: string;
  text: string;
  kind: RequirementKind;
  quote: string;
  /** True when the text is a support-checked paraphrase of a longer quote. */
  paraphrased: boolean;
}
export interface JobReadResult {
  source: "local" | "ai";
  fields: Partial<Record<JobField, ReadField>>;
  requirements: ReadRequirement[];
  /** Values and requirements dropped because the post did not support them. */
  withheld: number;
}

/** Whitespace normalisation only: runs of spaces, tabs and line breaks become one space. */
export const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
/** The listed normalisations for copied fields: case, whitespace and surrounding punctuation. */
export const loose = (text: string) =>
  collapse(text.normalize("NFC"))
    .toLowerCase()
    .replace(/^[\s"'“‘(\[«]+/, "")
    .replace(/[\s.,;:!?"'”’)\]»…]+$/, "");

/** Check 1: the quote is an exact substring of the post after whitespace normalisation. */
export function quoteInPost(quote: string, post: string) {
  const needle = collapse(quote);
  return needle.length > 0 && collapse(post).includes(needle);
}

/** Check 2 for copied fields: the value is the quote, or a part of it, after the listed normalisations. */
export function copiedFrom(value: string, quote: string) {
  const v = loose(value);
  return v.length > 0 && loose(quote).includes(v);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, word: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escape(word)}($|[^\\p{L}\\p{N}])`, "iu").test(text);

/** The canonical key for a work or employment type value, or null when it is not in the table. */
export function tableKey(table: Record<string, string[]>, value: string) {
  const v = loose(value);
  for (const [key, words] of Object.entries(table)) if (v === key || words.includes(v)) return key;
  return null;
}
/** Check 2 for typed fields: a known value whose source word appears in the quote. */
export function typedFrom(table: Record<string, string[]>, value: string, quote: string) {
  const key = tableKey(table, value);
  if (!key) return null;
  return [key, ...table[key]].some((word) => hasWord(quote, word)) ? key : null;
}
/** Finds the first table entry whose source word appears in a text (used by the local reader). */
export function findInTable(table: Record<string, string[]>, text: string) {
  for (const [key, words] of Object.entries(table))
    for (const word of [key, ...words]) if (hasWord(text, word)) return key;
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
/**
 * Unambiguous dates written in a text, as YYYY-MM-DD: 2026-12-01, 1 December
 * 2026, December 1, 2026. Numeric day/month forms such as 01/12/2026 are
 * ambiguous and never read.
 */
export function datesIn(text: string) {
  const found: string[] = [];
  const add = (value: string | null) => value && !found.includes(value) && found.push(value);
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(isoDate(+m[1], +m[2], +m[3]));
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}\\.?,?\\s+(\\d{4})\\b`, "gi")))
    add(isoDate(+m[3], MONTHS[m[2].toLowerCase()], +m[1]));
  for (const m of text.matchAll(new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi")))
    add(isoDate(+m[3], MONTHS[m[1].toLowerCase()], +m[2]));
  return found;
}
/** Check 2 for the deadline: a valid YYYY-MM-DD that round-trips to a date written in the quote. */
export function dateFrom(value: string, quote: string) {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (isoDate(y, m, d) !== v) return null;
  return datesIn(quote).includes(v) ? v : null;
}

/**
 * Validates one field read from a post (checks 1 and 2). Returns the value
 * to show (canonical for typed fields), or null when it must be withheld.
 */
export function checkField(field: JobField, value: string, quote: string, post: string): ReadField | null {
  const v = collapse(value);
  const q = collapse(quote);
  if (!v || !quoteInPost(q, post)) return null;
  let kept: string | null = null;
  if (field === "workType") kept = typedFrom(WORK_TYPES, v, q);
  else if (field === "employmentType") kept = typedFrom(EMPLOYMENT_TYPES, v, q);
  else if (field === "deadline") kept = dateFrom(v, q);
  else if (copiedFrom(v, q)) kept = v.replace(/[\s.,;:!]+$/, "");
  if (!kept || charCount(kept) > FIELD_MAX[field]) return null;
  if (field === "applyLink" && !/^https?:\/\/\S+$/i.test(kept)) return null;
  return { value: kept, quote: q };
}

// Must or nice comes from rules, never from the model (review finding 1).
const MUST_MARKERS = /\b(required|requirement|must|essential|mandatory|minimum|erforderlich|obligatorio|requis|exigé)\b/i;
const NICE_MARKERS =
  /\b(preferred|preferably|ideally|a plus|is a plus|nice to have|nice-to-have|bonus|desirable|advantage|advantageous|wünschenswert|von vorteil|deseable|valorable|un atout|souhaité)\b/i;
const MUST_HEADING =
  /^(requirements?|required|required (skills|qualifications|experience)|(minimum|basic|key|essential) (qualifications|requirements|skills|criteria)|qualifications|must[- ]haves?|essentials?|essential criteria|what you('|’)ll need|what you need|what we('|’)re looking for|what we expect|who you are|about you|your profile|you have|you bring|skills( and|&) experience|anforderungen|ihr profil|dein profil|voraussetzungen|requisitos|requisitos mínimos|exigences|profil recherché|votre profil)$/i;
const NICE_HEADING =
  /^(nice[- ]to[- ]haves?|preferred|preferred (skills|qualifications|experience)|bonus|bonus points|desirable|desirable (skills|criteria)|it('|’)s a plus|plus|extra credit|wünschenswert|von vorteil|deseable|se valorará|atouts?|un plus)$/i;
const BULLET = /^\s*([-*•·▪◦–—>]|\d+[.)])\s+/;
const headingText = (line: string) =>
  line
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\s*:\s*$/, "")
    .trim();
/** The kind a heading line announces, "other" for another section, or null when it is not a heading. */
export function headingKind(line: string): "must" | "nice" | "other" | null {
  const t = line.trim();
  if (!t || t.length > 80 || BULLET.test(t)) return null;
  const text = headingText(t);
  if (NICE_HEADING.test(text)) return "nice";
  if (MUST_HEADING.test(text)) return "must";
  if (!/:\s*$/.test(t)) return null;
  // A labelled heading such as "More requirements:" or "Preferred qualifications for this role:".
  if (/\b(nice[- ]to[- ]haves?|preferred|bonus|desirable|wünschenswert|deseable)\b/i.test(text)) return "nice";
  if (/\b(requirements?|qualifications|must[- ]haves?|anforderungen|requisitos|exigences)\b/i.test(text)) return "must";
  return "other";
}
/** must or nice from marker words in the quote, when exactly one kind is named. */
export function markerKind(quote: string): "must" | "nice" | null {
  const must = MUST_MARKERS.test(quote);
  const nice = NICE_MARKERS.test(quote);
  return must === nice ? null : must ? "must" : "nice";
}
/** Index of the line where a quote starts, or -1. */
function quoteLine(lines: string[], quote: string) {
  const needle = collapse(quote);
  for (let i = 0; i < lines.length; i++)
    for (let k = 1; k <= 12 && i + k <= lines.length; k++)
      if (collapse(lines.slice(i, i + k).join(" ")).includes(needle)) {
        if (k === 1 || !collapse(lines.slice(i + 1, i + k).join(" ")).includes(needle)) return i;
        break;
      }
  return -1;
}
/** The heading the quote sits under, read upward from its line. */
export function headingFor(quote: string, post: string): "must" | "nice" | null {
  const lines = post.split(/\r?\n/);
  const at = quoteLine(lines, quote);
  if (at < 0) return null;
  // An inline heading on the same line: "Requirements: 5 years of Python".
  const inline = lines[at].match(/^\s*([^:]{2,60}):\s*\S/);
  if (inline && !collapse(inline[1]).includes(collapse(quote))) {
    const kind = headingKind(`${inline[1]}:`);
    if (kind === "must" || kind === "nice") return kind;
  }
  for (let i = at - 1; i >= 0; i--) {
    const kind = headingKind(lines[i]);
    if (kind) return kind === "other" ? null : kind;
  }
  return null;
}
/** Check 4: a marker word in the quote, else the heading it sits under, else "Not stated". */
export function requirementKind(quote: string, post: string): RequirementKind {
  return markerKind(quote) ?? headingFor(quote, post) ?? "unstated";
}

/** Shortens a long quote at a word boundary to fit the 300-character requirement text. */
export function clipQuote(quote: string, max = REQUIREMENT_TEXT_MAX) {
  if (charCount(quote) <= max) return quote;
  const cut = sliceChars(quote, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${space > max / 2 ? cut.slice(0, space) : cut}…`;
}
