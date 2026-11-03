import type { Entry, ResumeDocument, Section } from "../document";
import { resolveCanonicalSkill } from "../skills-taxonomy";
import type { AtsLintIssue } from "./ats-linter";

/**
 * Whole-CV consistency check: statements that contradict each other, repeat
 * each other or may be hard to back up. Rule-based, no AI, runs in the
 * browser. Findings are advice: they never block an export and never score.
 *
 * Employment gaps, age and anything about protected characteristics are not
 * checked on purpose.
 *
 * Finding IDs are built from the IDs of the items involved plus a short hash
 * of the text they are about, so editing that text reopens a confirmed
 * finding.
 */
export const CONSISTENCY_RULES = [
  "date_order",
  "date_future",
  "date_missing",
  "date_overlap",
  "org_spelling",
  "title_variant",
  "duplicate_bullet",
  "repeated_number",
  "years_claim",
  "skill_without_evidence",
  "number_to_confirm",
] as const;
export type ConsistencyRule = (typeof CONSISTENCY_RULES)[number];

/** Findings the person can confirm as true, rather than fix or dismiss. */
export const CONFIRMABLE_RULES: ReadonlySet<string> = new Set<ConsistencyRule>([
  "number_to_confirm",
  "date_overlap",
  "skill_without_evidence",
  "years_claim",
]);

export function isConsistencyRule(ruleId: string): ruleId is ConsistencyRule {
  return (CONSISTENCY_RULES as readonly string[]).includes(ruleId);
}

/** Short, stable FNV-1a hash in base 36. */
export function textHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

// ---------------------------------------------------------------- dates

/** A YYYY or YYYY-MM date as [earliest, latest] month index, or null. */
export function monthRange(value: string): [number, number] | null {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]) * 12;
  if (match[2]) {
    const month = year + Number(match[2]) - 1;
    return [month, month];
  }
  return [year, year + 11];
}

const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();

function formatMonth(index: number) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Overlaps that are usually real, such as part-time or freelance work. */
const CONCURRENT_WORDS =
  /\b(part[- ]?time|freelance|freelancer|contract(or)?|consultant|consulting|volunteer(ing)?|concurrent|side project|self[- ]employed|adjunct|advisor|advisory|board member|internship)\b/i;

function isConcurrent(entry: Entry) {
  return CONCURRENT_WORDS.test(
    [entry.title, entry.organization, entry.location, entry.description].join(
      " ",
    ),
  );
}

function entryName(entry: Entry) {
  const title = collapse(entry.title);
  const org = collapse(entry.organization);
  if (title && org) return `${title} at ${org}`;
  return title || org || "this entry";
}

// ------------------------------------------------------------ names

const COMPANY_SUFFIXES = new Set([
  "ltd",
  "limited",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "plc",
  "corp",
  "corporation",
  "co",
  "company",
  "gmbh",
  "ag",
  "sa",
  "pvt",
  "private",
  "pty",
  "bv",
  "group",
]);

/** Employer name without case, punctuation or company suffixes. */
export function normalizeOrganization(value: string) {
  const words = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIXES.has(words.at(-1)!)) words.pop();
  if (words[0] === "the" && words.length > 1) words.shift();
  return words.join(" ");
}

const TITLE_ABBREVIATIONS: Record<string, string> = {
  sr: "senior",
  snr: "senior",
  jr: "junior",
  jnr: "junior",
  mgr: "manager",
  eng: "engineer",
  engr: "engineer",
  dev: "developer",
  asst: "assistant",
  assoc: "associate",
  dir: "director",
  vp: "vice president",
  svp: "senior vice president",
  mktg: "marketing",
  admin: "administrator",
  exec: "executive",
  coord: "coordinator",
  spec: "specialist",
  tech: "technician",
  ops: "operations",
};

/** Job title with common abbreviations expanded, ignoring case and punctuation. */
export function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => TITLE_ABBREVIATIONS[word] ?? word)
    .join(" ");
}

// ------------------------------------------------------------ text

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%$€£\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Share of distinct words two texts have in common (Jaccard). */
export function wordOverlap(a: string, b: string) {
  const left = new Set(words(a));
  const right = new Set(words(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

// A number, with thousands separators: 7, 3.5, 320,000.
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const SCALE = String.raw`(?:\s*(?:k|m|b|bn|million|billion|thousand)\b)?`;
const PERCENT = new RegExp(String.raw`(?<![\w.])(?:${NUM})\s?%`, "gi");
const MONEY = new RegExp(
  String.raw`[$€£¥]\s*(?:${NUM})(?:[kmb]\b|${SCALE})`,
  "gi",
);
const MULTIPLIER = new RegExp(String.raw`(?<![\w.])(?:${NUM})x(?!\w)`, "gi");
const COUNT = new RegExp(
  String.raw`(?<![\w.$€£¥])(?:${NUM})${SCALE}\+?\s+(?:[\p{L}-]+\s+){0,3}?(?:users|customers|clients|requests|queries|nodes|clusters|endpoints|microservices|services|pipelines|engineers|developers|designers|people|staff|employees|members|reports|students|patients|stores|sites|countries|markets|leads|sales|accounts|projects|products|transactions|orders|tickets|hours|days|weeks|months|minutes|seconds|ms)\b`,
  "giu",
);
const TEAM = new RegExp(String.raw`\bteams? of (?:${NUM})\b`, "gi");

/** Every number claim (percentages, money, counts, durations) in a text. */
export function numberClaims(text: string): string[] {
  const found: string[] = [];
  for (const pattern of [PERCENT, MONEY, MULTIPLIER, COUNT, TEAM])
    for (const match of text.matchAll(pattern)) found.push(collapse(match[0]));
  // Drop a claim already contained in a longer one ("$2" inside "$2.4M").
  return [...new Set(found)].filter(
    (claim, _, list) =>
      !list.some((other) => other !== claim && other.includes(claim)),
  );
}

/** Percentages, money and multipliers: the claims a copy-paste repeats. */
function distinctiveNumbers(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of [PERCENT, MONEY, MULTIPLIER])
    for (const match of text.matchAll(pattern))
      found.add(match[0].toLowerCase().replace(/\s+/g, ""));
  return [...found];
}

/**
 * Skills from a skills list. Commas inside brackets stay with their skill,
 * so "AWS (EKS, RDS)" is one skill.
 */
export function splitSkills(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(" || char === "[") depth++;
    if ((char === ")" || char === "]") && depth > 0) depth--;
    if (depth === 0 && /[·•,|;\n]/.test(char)) {
      items.push(current);
      current = "";
    } else current += char;
  }
  items.push(current);
  return items.map(collapse).filter(Boolean);
}

/** Ways a listed skill may be written elsewhere: "Agile / Scrum", "AWS (EKS)". */
function skillTerms(skill: string): string[] {
  const inner = [...skill.matchAll(/\(([^)]*)\)/g)].flatMap((m) =>
    m[1].split(/[,/]/),
  );
  const outer = skill.replace(/\([^)]*\)/g, " ");
  const parts = [outer, ...outer.split("/"), ...inner]
    .map(collapse)
    .filter((t) => t.length > 1 || /^[a-z]$/i.test(t));
  const terms = new Set([collapse(skill), ...parts]);
  for (const part of [...terms]) {
    const canonical = resolveCanonicalSkill(part);
    if (canonical)
      for (const alias of [canonical.name, ...canonical.aliases])
        terms.add(alias);
  }
  return [...terms];
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentions(corpus: string, term: string) {
  const clean = term.trim().toLowerCase();
  if (!clean) return false;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegex(clean)}(?![\\p{L}\\p{N}+#])`,
    "u",
  ).test(corpus);
}

// ------------------------------------------------------------ check

interface Located {
  section: Section;
  entry: Entry;
}

/**
 * Runs every consistency rule over the visible sections of a CV.
 * `today` is passed in so tests are stable.
 */
export function checkConsistency(
  doc: ResumeDocument,
  today: Date = new Date(),
): AtsLintIssue[] {
  const issues: AtsLintIssue[] = [];
  const visible = doc.sections.filter((section) => section.visible);
  const all = (filter: (section: Section) => boolean): Located[] =>
    visible
      .filter(filter)
      .flatMap((section) =>
        section.entries.map((entry) => ({ section, entry })),
      );
  const experience = all((s) => s.type === "experience");
  const now = monthIndex(today);

  // date_order, date_future, date_missing
  for (const { section, entry } of all(() => true)) {
    const start = monthRange(entry.start);
    const end = entry.current ? null : monthRange(entry.end);
    const name = entryName(entry);
    if (start && end && end[1] < start[0]) {
      issues.push({
        id: `cc-date-order-${entry.id}-${textHash(`${entry.start}|${entry.end}`)}`,
        ruleId: "date_order",
        severity: "warning",
        message: `${name}: the end date (${entry.end}) is before the start date (${entry.start}).`,
        sectionId: section.id,
        entryId: entry.id,
        category: "consistency",
      });
    }
    if (section.type === "experience" && end && end[0] > now) {
      issues.push({
        id: `cc-date-future-${entry.id}-${textHash(entry.end)}`,
        ruleId: "date_future",
        severity: "warning",
        message: `${name}: the end date (${entry.end}) is in the future. If you still work there, mark it as current.`,
        sectionId: section.id,
        entryId: entry.id,
        category: "consistency",
      });
    }
    if (
      section.type === "experience" &&
      !entry.start.trim() &&
      (entry.title.trim() || entry.organization.trim())
    ) {
      issues.push({
        id: `cc-date-missing-${entry.id}`,
        ruleId: "date_missing",
        severity: "warning",
        message: `${name} has no start date.`,
        sectionId: section.id,
        entryId: entry.id,
        category: "consistency",
      });
    }
  }

  // date_overlap: conservative bounds, so year-only dates do not invent overlaps.
  const spans = experience
    .map((item) => {
      const start = monthRange(item.entry.start);
      const end = item.entry.current ? [now, now] : monthRange(item.entry.end);
      if (!start || !end) return null;
      return { ...item, from: start[1], to: end[0] };
    })
    .filter(
      (span): span is NonNullable<typeof span> =>
        span !== null && span.to >= span.from,
    );
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i];
      const b = spans[j];
      if (isConcurrent(a.entry) || isConcurrent(b.entry)) continue;
      const months = Math.min(a.to, b.to) - Math.max(a.from, b.from) + 1;
      if (months < 3) continue;
      const dates = [a.entry, b.entry]
        .map((e) => `${e.start}|${e.current ? "current" : e.end}`)
        .join("|");
      issues.push({
        id: `cc-overlap-${a.entry.id}-${b.entry.id}-${textHash(dates)}`,
        ruleId: "date_overlap",
        severity: "suggestion",
        message: `${entryName(a.entry)} and ${entryName(b.entry)} overlap by about ${months} months (${formatMonth(Math.max(a.from, b.from))} to ${formatMonth(Math.min(a.to, b.to))}).`,
        sectionId: b.section.id,
        entryId: b.entry.id,
        relatedEntryIds: [a.entry.id, b.entry.id],
        category: "consistency",
      });
    }
  }

  // org_spelling and title_variant
  const variants = (
    items: Located[],
    pick: (entry: Entry) => string,
    normalize: (value: string) => string,
    ruleId: "org_spelling" | "title_variant",
    noun: string,
  ) => {
    const groups = new Map<string, Located[]>();
    for (const item of items) {
      const raw = collapse(pick(item.entry));
      const key = normalize(raw);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const [key, group] of groups) {
      const spellings = [
        ...new Set(group.map((item) => collapse(pick(item.entry)))),
      ];
      if (spellings.length < 2) continue;
      // Point at the first entry that does not use the most common spelling.
      const counts = spellings.map(
        (s) => group.filter((item) => collapse(pick(item.entry)) === s).length,
      );
      const common = spellings[counts.indexOf(Math.max(...counts))];
      const target = group.find(
        (item) => collapse(pick(item.entry)) !== common,
      )!;
      issues.push({
        id: `cc-${ruleId === "org_spelling" ? "org" : "title"}-${textHash(key)}-${textHash(spellings.join("|"))}`,
        ruleId,
        severity: "suggestion",
        message: `The same ${noun} is written ${spellings.length} ways: ${spellings.map((s) => `“${s}”`).join(", ")}.`,
        sectionId: target.section.id,
        entryId: target.entry.id,
        relatedEntryIds: group.map((item) => item.entry.id),
        category: "consistency",
      });
    }
  };
  variants(
    all((s) => s.type === "experience" || s.type === "education"),
    (entry) => entry.organization,
    normalizeOrganization,
    "org_spelling",
    "employer or school",
  );
  variants(
    experience,
    (entry) => entry.title,
    normalizeTitle,
    "title_variant",
    "job title",
  );

  // Bullets in achievement sections, in document order.
  const bullets = all(
    (s) => s.type === "experience" || s.type === "projects",
  ).flatMap(({ section, entry }) =>
    entry.bullets
      .filter((bullet) => bullet.text.trim())
      .map((bullet) => ({ section, entry, bullet })),
  );

  // duplicate_bullet
  for (let i = 0; i < bullets.length; i++) {
    for (let j = i + 1; j < bullets.length; j++) {
      const a = bullets[i];
      const b = bullets[j];
      if (words(a.bullet.text).length < 4 || words(b.bullet.text).length < 4)
        continue;
      if (wordOverlap(a.bullet.text, b.bullet.text) < 0.85) continue;
      issues.push({
        id: `cc-dup-${a.bullet.id}-${b.bullet.id}-${textHash(`${a.bullet.text}|${b.bullet.text}`)}`,
        ruleId: "duplicate_bullet",
        severity: "warning",
        message:
          a.entry.id === b.entry.id
            ? `This says the same as another bullet in ${entryName(a.entry)}: “${collapse(a.bullet.text)}”.`
            : `This says the same as a bullet in ${entryName(a.entry)}: “${collapse(a.bullet.text)}”.`,
        sectionId: b.section.id,
        entryId: b.entry.id,
        bulletId: b.bullet.id,
        relatedEntryIds: [a.entry.id, b.entry.id],
        relatedBulletIds: [a.bullet.id, b.bullet.id],
        category: "consistency",
      });
    }
  }

  // repeated_number: the same distinctive claim in two different entries.
  const byNumber = new Map<string, typeof bullets>();
  for (const item of bullets)
    for (const value of distinctiveNumbers(item.bullet.text))
      byNumber.set(value, [...(byNumber.get(value) ?? []), item]);
  for (const [value, items] of byNumber) {
    const entries = [...new Set(items.map((item) => item.entry.id))];
    if (entries.length < 2) continue;
    const second = items.find((item) => item.entry.id !== items[0].entry.id)!;
    issues.push({
      id: `cc-repeat-${textHash(value)}-${textHash(items.map((item) => `${item.bullet.id}:${item.bullet.text}`).join("|"))}`,
      ruleId: "repeated_number",
      severity: "suggestion",
      message: `“${value}” is claimed in ${entries.length} different roles or projects. Check that each one is right.`,
      sectionId: second.section.id,
      entryId: second.entry.id,
      bulletId: second.bullet.id,
      relatedEntryIds: entries,
      relatedBulletIds: items.map((item) => item.bullet.id),
      category: "consistency",
    });
  }

  // years_claim: "N years" in the headline or summary vs. the experience dates.
  const starts = experience
    .map(({ entry }) => monthRange(entry.start))
    .filter((range): range is [number, number] => range !== null);
  if (starts.length) {
    const first = Math.min(...starts.map((range) => range[0]));
    const last = Math.max(
      ...experience.map(({ entry }) => {
        if (entry.current) return now;
        return (
          monthRange(entry.end)?.[1] ?? monthRange(entry.start)?.[1] ?? first
        );
      }),
    );
    const spanYears = Math.max(0, (Math.min(last, now) - first + 1) / 12);
    const shown = Math.max(1, Math.round(spanYears));
    // Only claims about the person's own experience ("10+ years of
    // experience", "15 years leading teams"), not durations such as "a
    // 3-year roadmap" or "within 2 years of launch".
    const claim = new RegExp(
      String.raw`\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)['’]?\s+(?:of\s+)?(?:(?:hands-on|professional|industry|relevant|combined)\s+)?(?:experience|expertise|working|work|career|leading|managing|building|developing|designing|teaching|delivering|running|supporting|in\s+(?!a\b|an\b|the\b|which\b))`,
      "gi",
    );
    const sources: {
      text: string;
      sectionId: string;
      entryId?: string;
      field?: string;
      key: string;
    }[] = [
      {
        text: doc.contact.headline,
        sectionId: "contact",
        field: "headline",
        key: "headline",
      },
      ...visible
        .filter((section) => section.type === "summary")
        .flatMap((section) =>
          section.entries.map((entry) => ({
            text: entry.description,
            sectionId: section.id,
            entryId: entry.id,
            key: entry.id,
          })),
        ),
    ];
    for (const source of sources) {
      for (const match of source.text.matchAll(claim)) {
        const years = Number(match[1]);
        if (years <= spanYears + 1) continue;
        issues.push({
          id: `cc-years-${source.key}-${textHash(`${match[0]}|${first}|${last}`)}`,
          ruleId: "years_claim",
          // A targeted CV may list only recent roles, so a longer claim is
          // not a contradiction by itself: a suggestion the person can confirm.
          severity: "suggestion",
          message: `You say “${collapse(match[0]).replace(/\s+in$/i, "")}”, and the jobs listed here cover about ${shown} ${shown === 1 ? "year" : "years"}.`,
          sectionId: source.sectionId,
          entryId: source.entryId,
          field: source.field,
          category: "consistency",
        });
        break;
      }
    }
  }

  // skill_without_evidence: one grouped finding.
  const skillSections = visible.filter((section) => section.type === "skills");
  const skills = skillSections.flatMap((section) =>
    section.entries.flatMap((entry) => [
      ...splitSkills(entry.description),
      ...entry.bullets.flatMap((bullet) => splitSkills(bullet.text)),
    ]),
  );
  if (skills.length) {
    const corpus = [
      doc.contact.headline,
      ...visible
        .filter(
          (section) =>
            section.type !== "skills" && section.type !== "languages",
        )
        .flatMap((section) =>
          section.entries.flatMap((entry) => [
            entry.title,
            entry.organization,
            entry.description,
            ...entry.bullets.map((bullet) => bullet.text),
          ]),
        ),
    ]
      .join("\n")
      .toLowerCase();
    const seen = new Set<string>();
    const missing: string[] = [];
    for (const skill of skills) {
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!skillTerms(skill).some((term) => mentions(corpus, term)))
        missing.push(skill);
    }
    if (missing.length) {
      const section = skillSections.find((s) => s.entries.length)!;
      const listed = missing.slice(0, 8);
      const more = missing.length - listed.length;
      issues.push({
        id: `cc-skills-${section.id}-${textHash(
          missing
            .map((s) => s.toLowerCase())
            .sort()
            .join("|"),
        )}`,
        ruleId: "skill_without_evidence",
        severity: "suggestion",
        message: `${listed.join(", ")}${more > 0 ? ` and ${more} more` : ""}.`,
        sectionId: section.id,
        entryId: section.entries[0]?.id,
        category: "consistency",
      });
    }
  }

  // number_to_confirm: one finding per entry, so a CV full of numbers stays readable.
  const byEntry = new Map<
    string,
    { section: Section; entry: Entry; claims: string[]; firstBullet: string }
  >();
  for (const { section, entry, bullet } of bullets) {
    const claims = numberClaims(bullet.text);
    if (!claims.length) continue;
    const current = byEntry.get(entry.id);
    if (current) current.claims.push(...claims);
    else
      byEntry.set(entry.id, { section, entry, claims, firstBullet: bullet.id });
  }
  for (const { section, entry, claims, firstBullet } of byEntry.values()) {
    const unique = [...new Set(claims)];
    issues.push({
      id: `cc-numbers-${entry.id}-${textHash(unique.join("|"))}`,
      ruleId: "number_to_confirm",
      severity: "suggestion",
      message: `${entryName(entry)}: ${unique
        .slice(0, 4)
        .map((c) => `“${c}”`)
        .join(
          ", ",
        )}${unique.length > 4 ? ` and ${unique.length - 4} more` : ""}.`,
      sectionId: section.id,
      entryId: entry.id,
      bulletId: firstBullet,
      category: "consistency",
    });
  }

  return issues;
}
