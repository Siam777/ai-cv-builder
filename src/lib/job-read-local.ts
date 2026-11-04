import {
  EMPLOYMENT_TYPES,
  REQUIREMENT_MAX,
  WORK_TYPES,
  checkField,
  clipQuote,
  collapse,
  datesIn,
  findInTable,
  headingKind,
  requirementKind,
  type JobField,
  type JobReadResult,
  type ReadField,
  type ReadRequirement,
} from "./job-read";

/**
 * The free local reader ("Read the post"): plain text rules that run in the
 * browser. It sends nothing anywhere, works for guests and without AI
 * consent, and every value it returns carries the line it came from. It is
 * a first pass for the person to correct, not an understanding of the post.
 */

const BULLET = /^\s*([-*•·▪◦–—>]|\d+[.)])\s+/;
const LABEL =
  /^\s*(job title|title|position|role|company|employer|location|salary|pay|compensation|deadline|closing date|apply by|puesto|empresa|ubicación|salario|stelle|unternehmen|standort|gehalt|poste|entreprise|lieu|salaire)\s*:\s*(.+)$/i;
const NOT_COMPANY = /^(us|the (role|job|team|position|company)|this (role|job|position)|you|the opportunity|our team)\b/i;
const CURRENCY = String.raw`(?:[$£€¥₹৳]|USD|EUR|GBP|CAD|AUD|INR|BDT|JPY|CHF)`;
const AMOUNT = String.raw`\d[\d,.]*\s?[kKmM]?`;
const PERIOD = String.raw`(?:\s*(?:per|\/|a|an|al|pro|par)\s*(?:year|yr|annum|month|mo|hour|hr|day|año|mes|jahr|monat|an|mois))?`;
const SALARY = new RegExp(
  String.raw`${CURRENCY}\s?${AMOUNT}(?:\s?(?:-|–|—|to|bis|a)\s?(?:${CURRENCY}\s?)?${AMOUNT})?(?:\s?${CURRENCY})?${PERIOD}` +
    String.raw`|${AMOUNT}\s?(?:${CURRENCY}\s?)?(?:-|–|—|to|bis|a)\s?${AMOUNT}\s?${CURRENCY}${PERIOD}` +
    String.raw`|${AMOUNT}\s?${CURRENCY}${PERIOD}`,
  "i",
);
const DEADLINE_CUE = /\b(apply by|deadline|closing date|applications close|closes on|close on|apply before|bewerbungsschluss|fecha límite|date limite)\b/i;

export function readJobPostLocally(post: string, url?: string): JobReadResult {
  const lines = post.split(/\r?\n/);
  const fields: Partial<Record<JobField, ReadField>> = {};
  const put = (field: JobField, value: string, quote: string) => {
    if (fields[field]) return;
    const checked = checkField(field, value, quote, post);
    if (checked) fields[field] = checked;
  };

  // Labelled lines first: "Location: Berlin", "Salary: €60,000".
  for (const line of lines) {
    const m = line.match(LABEL);
    if (!m) continue;
    const label = m[1].toLowerCase();
    const value = collapse(m[2]);
    if (/title|position|role|puesto|stelle|poste/.test(label)) put("role", value, line);
    else if (/company|employer|empresa|unternehmen|entreprise/.test(label)) put("company", value, line);
    else if (/location|ubicación|standort|lieu/.test(label)) put("location", value, line);
    else if (/salary|pay|compensation|salario|gehalt|salaire/.test(label))
      put("salary", value.match(SALARY)?.[0] ?? value, line);
    else {
      const date = datesIn(value)[0];
      if (date) put("deadline", date, line);
    }
  }

  // Title from the first line, and a company after "at" on it.
  const first = lines.find((line) => line.trim().length > 0) ?? "";
  if (first && !headingKind(first) && collapse(first).length <= 160) {
    const at = first.match(/^(.+?)\s+(?:at|@)\s+([^,.\n(|–—-]{2,80}?)\s*(?:[,.(|–—-].*)?$/);
    if (at) {
      put("role", at[1], first);
      if (!NOT_COMPANY.test(at[2].trim())) put("company", at[2], first);
    } else put("role", first.replace(/^\s*(job title|title|position|role)\s*:\s*/i, ""), first);
  }
  // "About Northwind" heading, or "Northwind is hiring", or "at Northwind" in the text.
  for (const line of lines) {
    if (fields.company) break;
    const about = line.match(/^\s*#*\s*About\s+([^:]{2,60}?)\s*:?\s*$/);
    if (about && !NOT_COMPANY.test(about[1])) put("company", about[1], line);
  }
  for (const line of lines) {
    if (fields.company) break;
    const hiring = line.match(/^\s*([A-Z][\w&.'’ -]{1,60}?)\s+(?:is hiring|is looking for|are hiring|are looking for)\b/);
    if (hiring && !NOT_COMPANY.test(hiring[1])) put("company", hiring[1], line);
    const join = line.match(/\b(?:join|at)\s+([A-Z][\w&'’-]*(?:\s+[A-Z][\w&'’-]*){0,3})/);
    if (!fields.company && join && !NOT_COMPANY.test(join[1])) put("company", join[1], line);
  }

  // Location from "based in", work and employment type words, salary, deadline.
  for (const line of lines) {
    if (!fields.location) {
      const based = line.match(/\b(?:based in|located in|office in)\s+([A-Z][\p{L}' -]{1,40}?(?:,\s*[A-Z][\p{L}' -]{1,30})?)(?=[.;\n]|$|\s+(?:with|and|or)\b)/u);
      if (based) put("location", based[1], line);
    }
    if (!fields.workType) {
      const key = findInTable(WORK_TYPES, line);
      if (key) put("workType", key, line);
    }
    if (!fields.employmentType) {
      const key = findInTable(EMPLOYMENT_TYPES, line);
      if (key) put("employmentType", key, line);
    }
    if (!fields.salary) {
      const pay = line.match(SALARY);
      if (pay && /\d{2}/.test(pay[0])) put("salary", pay[0], line);
    }
    if (!fields.deadline && DEADLINE_CUE.test(line)) {
      const date = datesIn(line)[0];
      if (date) put("deadline", date, line);
    }
  }
  const link = url?.trim() || post.match(/https?:\/\/[^\s<>"')]+/)?.[0];
  if (link) {
    if (url?.trim()) {
      if (/^https?:\/\/\S+$/i.test(url.trim())) fields.applyLink = { value: url.trim(), quote: url.trim() };
    } else put("applyLink", link, link);
  }

  // Requirements: the lines under a must or nice heading, until another heading.
  const requirements: ReadRequirement[] = [];
  const seen = new Set<string>();
  let section: "must" | "nice" | "other" | null = null;
  for (const line of lines) {
    const heading = headingKind(line);
    const inline = line.match(/^\s*([^:]{2,60}):\s*(\S.*)$/);
    if (heading) {
      section = heading;
      continue;
    }
    if (LABEL.test(line)) {
      section = null; // "Salary: …" and similar lines end a requirement list.
      continue;
    }
    if (inline && !BULLET.test(line)) {
      const kind = headingKind(`${inline[1]}:`);
      if (kind === "must" || kind === "nice") {
        // "Requirements: SQL, dashboards and Python" lists items inline.
        section = kind;
        for (const part of inline[2].split(/[,;]|\s+and\s+/)) add(part);
        continue;
      }
    }
    if (section !== "must" && section !== "nice") continue;
    if (!line.trim()) continue;
    add(line.replace(BULLET, ""));
  }
  function add(raw: string) {
    const quote = collapse(raw).replace(/[;,]$/, "");
    if (quote.length < 2 || requirements.length >= REQUIREMENT_MAX) return;
    const key = quote.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const text = clipQuote(quote);
    requirements.push({
      id: `local-${requirements.length + 1}`,
      text,
      kind: requirementKind(quote, post),
      quote: text,
      paraphrased: false,
    });
  }
  return { source: "local", fields, requirements, withheld: 0 };
}
