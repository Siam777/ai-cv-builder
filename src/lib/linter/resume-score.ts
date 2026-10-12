import type { ResumeDocument } from "../document";
import { STRONG_ACTION_VERBS } from "../vault/impact-coach";
import { TAXONOMY_SKILLS } from "../skills-taxonomy";
import {
  hasQuantifiableMetric,
  isWeakOpening,
  wordCount,
} from "./ats-linter";

/**
 * Transparent, deterministic resume quality score.
 *
 * Every point comes from a named check the user can see and fix. The score
 * describes the written content against common recruiter guidance; it does not
 * predict ATS acceptance, interviews or hiring outcomes.
 */

export const RESUME_SCORE_VERSION = "resume-score-1";

export type ScoreCategoryId = "impact" | "completeness" | "clarity" | "consistency";

export interface ScoreCheck {
  id: string;
  label: string;
  earned: number;
  max: number;
  detail: string;
  /** Present when points were lost: one concrete next step. */
  fix?: string;
  /** Where the fix happens in the editor. */
  sectionType?: string;
}

export interface ScoreCategory {
  id: ScoreCategoryId;
  label: string;
  description: string;
  score: number;
  max: number;
  checks: ScoreCheck[];
}

export type BenchmarkStatus = "below" | "within" | "above";

export interface Benchmark {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  /** Human-readable target, e.g. "3–6". */
  target: string;
  unit: string;
  status: BenchmarkStatus;
  advice: string;
}

export type ScoreGrade = "Excellent" | "Strong" | "Fair" | "Needs work";

export interface ResumeScore {
  version: string;
  total: number;
  grade: ScoreGrade;
  categories: ScoreCategory[];
  benchmarks: Benchmark[];
  /** Highest-value fixes first, from checks that lost the most points. */
  topFixes: Array<{ label: string; fix: string; points: number; sectionType?: string }>;
  stats: ResumeStats;
}

export interface ResumeStats {
  words: number;
  bullets: number;
  quantifiedBullets: number;
  actionVerbBullets: number;
  weakOpenings: number;
  rolesWithBullets: number;
  averageBulletsPerRole: number;
  averageBulletWords: number;
  bulletsInLengthRange: number;
  summaryWords: number;
  skillsCount: number;
  experienceYears: number;
}

function listJoin(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items.join("");
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function experienceBullets(doc: ResumeDocument) {
  return doc.sections
    .filter((s) => s.visible && (s.type === "experience" || s.type === "projects"))
    .flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => b.text.trim())))
    .filter(Boolean);
}

export function startsWithActionVerb(text: string): boolean {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  if (!first || isWeakOpening(text)) return false;
  if (STRONG_ACTION_VERBS.has(first)) return true;
  // Past-tense openings ("Facilitated", "Coordinated") read as accomplishments.
  return first.length > 4 && first.endsWith("ed");
}

function skillItems(doc: ResumeDocument): string[] {
  const items = new Set<string>();
  for (const section of doc.sections) {
    if (!section.visible || section.type !== "skills") continue;
    for (const entry of section.entries) {
      const parts = entry.bullets.length
        ? entry.bullets.map((b) => b.text)
        : entry.description.split(/[,·•|;\n]/);
      for (const part of parts) {
        const value = part.trim().toLowerCase();
        if (value) items.add(value);
      }
    }
  }
  return [...items];
}

function documentWords(doc: ResumeDocument): number {
  let words = wordCount(`${doc.contact.name} ${doc.contact.headline}`);
  for (const section of doc.sections) {
    if (!section.visible) continue;
    for (const entry of section.entries) {
      words += wordCount(
        [entry.title, entry.organization, entry.location, entry.description, ...entry.bullets.map((b) => b.text)].join(" "),
      );
    }
  }
  return words;
}

function monthIndex(value: string): number | null {
  const match = value.match(/^(\d{4})(?:-(\d{2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 12 + (match[2] ? Number(match[2]) - 1 : 0);
}

/** Total years covered by experience entries, with overlapping ranges merged. */
export function experienceYears(doc: ResumeDocument, now = new Date()): number {
  const current = now.getFullYear() * 12 + now.getMonth();
  const ranges: Array<[number, number]> = [];
  for (const section of doc.sections) {
    if (!section.visible || section.type !== "experience") continue;
    for (const entry of section.entries) {
      const start = monthIndex(entry.start);
      if (start === null) continue;
      const end = entry.current ? current : monthIndex(entry.end) ?? start;
      if (end >= start) ranges.push([start, end]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let months = 0;
  let open: [number, number] | null = null;
  for (const range of ranges) {
    if (open && range[0] <= open[1]) open[1] = Math.max(open[1], range[1]);
    else {
      if (open) months += open[1] - open[0];
      open = [...range];
    }
  }
  if (open) months += open[1] - open[0];
  return round1(months / 12);
}

export function collectResumeStats(doc: ResumeDocument): ResumeStats {
  const bullets = experienceBullets(doc);
  const bulletWords = bullets.map(wordCount);
  const roles = doc.sections
    .filter((s) => s.visible && s.type === "experience")
    .flatMap((s) => s.entries)
    .filter((e) => e.bullets.some((b) => b.text.trim()));
  const summary = doc.sections
    .filter((s) => s.visible && s.type === "summary")
    .flatMap((s) => s.entries)
    .map((e) => [e.description, ...e.bullets.map((b) => b.text)].join(" "))
    .join(" ");
  return {
    words: documentWords(doc),
    bullets: bullets.length,
    quantifiedBullets: bullets.filter(hasQuantifiableMetric).length,
    actionVerbBullets: bullets.filter(startsWithActionVerb).length,
    weakOpenings: bullets.filter(isWeakOpening).length,
    rolesWithBullets: roles.length,
    averageBulletsPerRole: roles.length
      ? round1(roles.reduce((n, e) => n + e.bullets.filter((b) => b.text.trim()).length, 0) / roles.length)
      : 0,
    averageBulletWords: bulletWords.length
      ? round1(bulletWords.reduce((a, b) => a + b, 0) / bulletWords.length)
      : 0,
    bulletsInLengthRange: bulletWords.filter((w) => w >= 8 && w <= 30).length,
    summaryWords: wordCount(summary),
    skillsCount: skillItems(doc).length,
    experienceYears: experienceYears(doc),
  };
}

function check(
  id: string,
  label: string,
  max: number,
  ratio: number,
  detail: string,
  fix: string,
  sectionType?: string,
): ScoreCheck {
  const earned = round1(max * clamp01(ratio));
  return {
    id,
    label,
    max,
    earned,
    detail,
    ...(earned < max ? { fix, sectionType } : {}),
  };
}

function category(
  id: ScoreCategoryId,
  label: string,
  description: string,
  checks: ScoreCheck[],
): ScoreCategory {
  return {
    id,
    label,
    description,
    checks,
    score: round1(checks.reduce((n, c) => n + c.earned, 0)),
    max: checks.reduce((n, c) => n + c.max, 0),
  };
}

function benchmark(
  id: string,
  label: string,
  value: number,
  min: number,
  max: number,
  unit: string,
  advice: { below: string; within: string; above: string },
  display = `${value}`,
  target = max === Infinity ? `${min}+` : `${min}–${max}`,
): Benchmark {
  const status: BenchmarkStatus = value < min ? "below" : value > max ? "above" : "within";
  return { id, label, value, display, min, max, target, unit, status, advice: advice[status] };
}

function inRange(value: number, min: number, max: number, softness: number) {
  if (value >= min && value <= max) return 1;
  const distance = value < min ? min - value : value - max;
  return clamp01(1 - distance / softness);
}

export function scoreResume(doc: ResumeDocument): ResumeScore {
  const stats = collectResumeStats(doc);
  const c = doc.contact;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const quantifiedPct = pct(stats.quantifiedBullets, stats.bullets);
  const actionPct = pct(stats.actionVerbBullets, stats.bullets);
  const lengthPct = pct(stats.bulletsInLengthRange, stats.bullets);

  const experience = doc.sections.filter((s) => s.visible && s.type === "experience").flatMap((s) => s.entries);
  const allEntries = doc.sections
    .filter((s) => s.visible && !["summary", "skills", "languages"].includes(s.type))
    .flatMap((s) => s.entries);
  const hasSection = (type: string) =>
    doc.sections.some((s) => s.visible && s.type === type && s.entries.length > 0);

  const impact = category("impact", "Impact", "Do your bullets show results, not just duties?", [
    check(
      "quantified",
      "Measurable results",
      20,
      stats.bullets ? stats.quantifiedBullets / Math.max(1, stats.bullets * 0.4) : 0,
      stats.bullets
        ? `${stats.quantifiedBullets} of ${stats.bullets} bullets (${quantifiedPct}%) include a number, %, money, time or scale.`
        : "No experience or project bullets yet.",
      stats.bullets
        ? "Add a real number to more bullets: how much, how many, how fast, or how often. Aim for about 4 in 10."
        : "Add 3–5 accomplishment bullets under each recent role.",
      "experience",
    ),
    check(
      "action-verbs",
      "Strong action verbs",
      10,
      stats.bullets ? stats.actionVerbBullets / Math.max(1, stats.bullets * 0.7) : 0,
      stats.bullets
        ? `${stats.actionVerbBullets} of ${stats.bullets} bullets (${actionPct}%) start with an action verb.`
        : "No bullets to check.",
      "Start each bullet with what you did: Led, Built, Reduced, Launched, Negotiated.",
      "experience",
    ),
    check(
      "weak-openings",
      "No vague openings",
      5,
      stats.bullets ? 1 - stats.weakOpenings / Math.max(1, Math.ceil(stats.bullets / 4)) : 0,
      stats.weakOpenings
        ? `${stats.weakOpenings} bullet${stats.weakOpenings === 1 ? "" : "s"} open with phrases like "Responsible for" or "Worked on".`
        : stats.bullets
          ? "No vague openings found."
          : "No bullets to check.",
      'Rewrite "Responsible for…" and "Worked on…" bullets to lead with the action and its result.',
      "experience",
    ),
  ]);

  const contactPoints =
    (c.name.trim() ? 3 : 0) +
    (c.email.trim() ? 3 : 0) +
    (c.phone.trim() ? 2 : 0) +
    (c.location.trim() ? 1 : 0) +
    (c.website.trim() ? 1 : 0);
  const missingContact = [
    !c.name.trim() && "name",
    !c.email.trim() && "email",
    !c.phone.trim() && "phone",
    !c.location.trim() && "location",
    !c.website.trim() && "a portfolio or LinkedIn link",
  ].filter(Boolean) as string[];

  const completeness = category(
    "completeness",
    "Completeness",
    "Does a recruiter have everything needed to evaluate and reach you?",
    [
      check(
        "contact",
        "Contact details",
        10,
        contactPoints / 10,
        missingContact.length ? `Missing: ${missingContact.join(", ")}.` : "Name, email, phone, location and a link are present.",
        `Add your ${listJoin(missingContact)} in Personal details.`,
        "contact",
      ),
      check(
        "summary",
        "Profile summary",
        5,
        stats.summaryWords === 0 ? 0 : inRange(stats.summaryWords, 25, 80, 40),
        stats.summaryWords ? `${stats.summaryWords}-word summary.` : "No profile summary.",
        stats.summaryWords
          ? "Keep the summary to 2–4 sentences (about 25–80 words): who you are, your strength, and one proof point."
          : "Add a 2–4 sentence summary: your role, years of experience, strengths and one proof point.",
        "summary",
      ),
      check(
        "experience",
        "Work experience with detail",
        5,
        stats.rolesWithBullets ? 1 : experience.length ? 0.4 : 0,
        stats.rolesWithBullets
          ? `${stats.rolesWithBullets} role${stats.rolesWithBullets === 1 ? "" : "s"} with accomplishment bullets.`
          : experience.length
            ? "Roles are listed but have no bullets."
            : "No experience entries yet.",
        experience.length ? "Add accomplishment bullets under each role." : "Add your work experience, internships or volunteer roles.",
        "experience",
      ),
      check(
        "education",
        "Education",
        2.5,
        hasSection("education") ? 1 : 0,
        hasSection("education") ? "Education is listed." : "No education entries.",
        "Add your highest qualification, school and year.",
        "education",
      ),
      check(
        "skills",
        "Skills list",
        2.5,
        stats.skillsCount / 6,
        `${stats.skillsCount} skill${stats.skillsCount === 1 ? "" : "s"} listed.`,
        "List at least 6 relevant skills, grouped by type (tools, methods, languages).",
        "skills",
      ),
    ],
  );

  const clarity = category("clarity", "Clarity & length", "Is it easy to skim in under a minute?", [
    check(
      "bullet-length",
      "Bullet length",
      10,
      stats.bullets ? stats.bulletsInLengthRange / stats.bullets / 0.8 : 0,
      stats.bullets
        ? `${lengthPct}% of bullets are 8–30 words (average ${stats.averageBulletWords}).`
        : "No bullets to check.",
      "Keep each bullet to one or two lines: split long ones and give short ones a result.",
      "experience",
    ),
    check(
      "bullets-per-role",
      "Bullets per role",
      5,
      stats.rolesWithBullets ? inRange(stats.averageBulletsPerRole, 3, 6, 3) : 0,
      stats.rolesWithBullets ? `Average of ${stats.averageBulletsPerRole} bullets per role.` : "No roles with bullets.",
      "Aim for 3–6 bullets on recent roles and fewer on older ones.",
      "experience",
    ),
    check(
      "overall-length",
      "Overall length",
      5,
      inRange(stats.words, 300, 900, 300),
      `${stats.words} words in total.`,
      stats.words < 300
        ? "Add more detail: most effective resumes run 300–900 words (one to two pages)."
        : "Trim older or less relevant detail to stay within about two pages.",
    ),
  ]);

  const datesTotal = allEntries.filter((e) => e.start || e.end || e.current).length;
  const datesValid = allEntries.filter(
    (e) => monthIndex(e.start) !== null && (e.current || e.end === "" || monthIndex(e.end) !== null),
  ).length;
  const datedExperience = experience.filter((e) => monthIndex(e.start) !== null);
  let ordered = 0;
  for (let i = 1; i < datedExperience.length; i++) {
    const prev = datedExperience[i - 1];
    const next = datedExperience[i];
    if ((monthIndex(prev.start) ?? 0) >= (monthIndex(next.start) ?? 0)) ordered++;
  }
  const orderRatio = datedExperience.length > 1 ? ordered / (datedExperience.length - 1) : datedExperience.length ? 1 : 0;
  const labelled = allEntries.filter((e) => e.title.trim()).length;
  const withOrg = experience.filter((e) => e.organization.trim()).length;

  const consistency = category(
    "consistency",
    "Structure",
    "Are dates, titles and order consistent and easy to follow?",
    [
      check(
        "dates",
        "Dates on every role",
        6,
        experience.length ? experience.filter((e) => monthIndex(e.start) !== null).length / experience.length : 0,
        experience.length
          ? `${experience.filter((e) => monthIndex(e.start) !== null).length} of ${experience.length} roles have a start date.`
          : "No roles to check.",
        "Give every role a start and end month (or mark it current).",
        "experience",
      ),
      check(
        "date-format",
        "Consistent date format",
        4,
        datesTotal ? datesValid / datesTotal : 0,
        datesTotal ? `${datesValid} of ${datesTotal} dated entries use a consistent format.` : "No dates found.",
        "Use the date pickers so every entry shows the same month and year format.",
        "experience",
      ),
      check(
        "titles",
        "Job titles and employers",
        6,
        allEntries.length
          ? (labelled / allEntries.length) * 0.5 + (experience.length ? (withOrg / experience.length) * 0.5 : 0.5)
          : 0,
        allEntries.length
          ? `${labelled} of ${allEntries.length} entries have a title; ${withOrg} of ${experience.length} roles name an employer.`
          : "No entries yet.",
        "Give every entry a clear title, and every role its employer.",
        "experience",
      ),
      check(
        "order",
        "Most recent first",
        4,
        orderRatio,
        datedExperience.length > 1
          ? orderRatio === 1
            ? "Roles run from newest to oldest."
            : "Some roles are out of date order."
          : "Not enough dated roles to check order.",
        "Order roles from newest to oldest.",
        "experience",
      ),
    ],
  );

  const categories = [impact, completeness, clarity, consistency];
  const total = Math.round(categories.reduce((n, cat) => n + cat.score, 0));
  const grade: ScoreGrade = total >= 90 ? "Excellent" : total >= 75 ? "Strong" : total >= 55 ? "Fair" : "Needs work";

  const topFixes = categories
    .flatMap((cat) => cat.checks)
    .filter((ch) => ch.fix)
    .map((ch) => ({ label: ch.label, fix: ch.fix!, points: round1(ch.max - ch.earned), sectionType: ch.sectionType }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  const benchmarks: Benchmark[] = [
    benchmark("words", "Total length", stats.words, 300, 900, "words", {
      below: "Shorter than most effective resumes. Add detail to recent roles.",
      within: "In the typical one-to-two page range.",
      above: "Longer than most. Trim older roles and repeated points.",
    }),
    benchmark("quantified", "Bullets with numbers", quantifiedPct, 40, 100, "%", {
      below: "Below the common target. Quantify outcomes you can support.",
      within: "Good use of measurable results.",
      above: "",
    }, `${quantifiedPct}%`, "40%+"),
    benchmark("action", "Action-verb openings", actionPct, 70, 100, "%", {
      below: "Many bullets start with something other than what you did.",
      within: "Bullets lead with clear actions.",
      above: "",
    }, `${actionPct}%`, "70%+"),
    benchmark("bullets-per-role", "Bullets per role", stats.averageBulletsPerRole, 3, 6, "bullets", {
      below: "Thin detail per role. Add accomplishments to recent roles.",
      within: "A skimmable amount of detail per role.",
      above: "Dense roles. Keep the strongest 3–6 bullets.",
    }),
    benchmark("bullet-words", "Words per bullet", stats.averageBulletWords, 10, 25, "words", {
      below: "Bullets are terse. Add the result or scope.",
      within: "Concise one-to-two line bullets.",
      above: "Bullets run long. Split or tighten them.",
    }),
    benchmark("summary", "Summary length", stats.summaryWords, 25, 80, "words", {
      below: stats.summaryWords ? "A little brief. Add a strength and a proof point." : "Add a short profile summary.",
      within: "A focused summary.",
      above: "Long for a summary. Keep it to 2–4 sentences.",
    }),
    benchmark("skills", "Skills listed", stats.skillsCount, 6, 25, "skills", {
      below: "List more of the relevant tools and methods you use.",
      within: "A well-sized skills list.",
      above: "A very long list dilutes focus. Keep the most relevant.",
    }),
  ];

  return { version: RESUME_SCORE_VERSION, total, grade, categories, benchmarks, topFixes, stats };
}

/* ------------------------------------------------------------------------- */
/* Job gap analysis                                                          */
/* ------------------------------------------------------------------------- */

export interface KeywordMatch {
  name: string;
  /** Requirement context: required lines outrank preferred ones. */
  importance: "required" | "preferred";
  found: boolean;
  /** Where the term appears in the resume, if found. */
  foundIn: Array<"skills" | "experience" | "summary" | "other">;
}

export interface JobGapAnalysis {
  version: string;
  matchPercent: number;
  keywords: KeywordMatch[];
  matched: KeywordMatch[];
  missing: KeywordMatch[];
  /** Found only in the skills list, never shown in action in a bullet. */
  unproven: KeywordMatch[];
  years: { required: number | null; candidate: number; meets: boolean | null };
  education: { required: string | null; found: boolean | null };
  nextSteps: string[];
}

/** Common English words that are also skill aliases; these require an exact-case name match. */
const AMBIGUOUS_TERMS = new Set([
  "next", "go", "express", "spring", "swift", "rust", "r", "c", "dart", "ember", "flutter",
  "jest", "chef", "puppet", "salt", "make", "redux", "vue", "elm", "julia", "scala", "excel",
  "word", "office", "slack", "notion", "jira", "git", "agile", "scrum", "lean", "sketch",
]);

/** Non-tool keywords common in postings, as display names (matched case-insensitively). */
const SOFT_KEYWORDS = [
  "Leadership", "Mentoring", "Stakeholder management", "Communication", "Cross-functional",
  "Project management", "Budgeting", "Forecasting", "Negotiation", "Customer success",
  "Data analysis", "A/B testing", "User research", "Roadmap", "Strategy", "Compliance",
  "Recruiting", "Coaching", "Presentation", "Sales", "Marketing", "SEO", "Content strategy",
  "Accessibility", "Security", "Testing", "CI/CD", "Microservices", "Distributed systems",
  "Machine learning", "Analytics", "SQL",
];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termRegex(term: string, caseSensitive: boolean) {
  return new RegExp(`(^|[^A-Za-z0-9+#])${escapeRegex(term)}(?![A-Za-z0-9+#])`, caseSensitive ? "" : "i");
}

interface TermDef {
  name: string;
  patterns: RegExp[];
}

let termCache: TermDef[] | null = null;
function knownTerms(): TermDef[] {
  if (termCache) return termCache;
  const defs: TermDef[] = TAXONOMY_SKILLS.map((skill) => {
    const terms = [skill.name, ...skill.aliases];
    const patterns = terms.flatMap((term) => {
      const lower = term.toLowerCase();
      if (AMBIGUOUS_TERMS.has(lower) || lower.length <= 2) {
        // Only an exact-case canonical name ("Go", "Swift") counts.
        return term === skill.name && /[A-Z]/.test(term) ? [termRegex(term, true)] : [];
      }
      return [termRegex(term, false)];
    });
    return { name: skill.name, patterns };
  });
  for (const keyword of SOFT_KEYWORDS) {
    if (!defs.some((d) => d.name.toLowerCase() === keyword.toLowerCase())) {
      // "Mentoring" should also find "Mentored" and "mentor": match the word stem.
      const stem = /^[A-Za-z]+ing$/.test(keyword) ? keyword.slice(0, -3) : null;
      defs.push({
        name: keyword,
        patterns: [stem ? new RegExp(`(^|[^A-Za-z])${stem}[a-z]*`, "i") : termRegex(keyword, false)],
      });
    }
  }
  termCache = defs.filter((d) => d.patterns.length > 0);
  return termCache;
}

function resumeText(doc: ResumeDocument) {
  const parts = { skills: [] as string[], experience: [] as string[], summary: [] as string[], other: [] as string[] };
  parts.other.push(doc.contact.headline);
  for (const section of doc.sections) {
    if (!section.visible) continue;
    const key =
      section.type === "skills" ? "skills"
      : section.type === "experience" || section.type === "projects" ? "experience"
      : section.type === "summary" ? "summary"
      : "other";
    for (const entry of section.entries) {
      parts[key].push(entry.title, entry.organization, entry.description, ...entry.bullets.map((b) => b.text));
    }
  }
  return Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.join("\n")])) as Record<
    "skills" | "experience" | "summary" | "other",
    string
  >;
}

const PREFERRED_LINE = /preferred|nice to have|bonus|plus\b|ideally|desirable|advantage/i;
const PREFERRED_HEADER = /^(preferred|nice to have|bonus|desired|plus if)/i;
const REQUIRED_HEADER = /^(requirements|qualifications|must have|what you.ll need|what we.re looking for|who you are|minimum|responsibilities|what you.ll do)/i;

export function analyzeJobGap(doc: ResumeDocument, jobDescription: string, now = new Date()): JobGapAnalysis {
  const lines = jobDescription.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const importance = new Map<string, "required" | "preferred">();
  let inPreferred = false;
  for (const line of lines) {
    if (PREFERRED_HEADER.test(line)) inPreferred = true;
    else if (REQUIRED_HEADER.test(line)) inPreferred = false;
    const level = inPreferred || PREFERRED_LINE.test(line) ? "preferred" : "required";
    for (const def of knownTerms()) {
      if (def.patterns.some((p) => p.test(line))) {
        if (importance.get(def.name) !== "required") importance.set(def.name, level);
      }
    }
  }

  const text = resumeText(doc);
  const keywords: KeywordMatch[] = [...importance.entries()].map(([name, level]) => {
    const def = knownTerms().find((d) => d.name === name)!;
    const foundIn = (Object.keys(text) as Array<keyof typeof text>).filter((key) =>
      def.patterns.some((p) => p.test(text[key])),
    );
    return { name, importance: level, found: foundIn.length > 0, foundIn };
  });
  keywords.sort((a, b) =>
    a.importance === b.importance ? a.name.localeCompare(b.name) : a.importance === "required" ? -1 : 1,
  );

  const weightOf = (k: KeywordMatch) => (k.importance === "required" ? 1 : 0.5);
  const totalWeight = keywords.reduce((n, k) => n + weightOf(k), 0);
  const matchedWeight = keywords.filter((k) => k.found).reduce((n, k) => n + weightOf(k), 0);

  const yearMatches = [...jobDescription.matchAll(/(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?years?/gi)].map((m) => Number(m[1]));
  const requiredYears = yearMatches.length ? Math.max(...yearMatches.filter((n) => n <= 30)) : null;
  const candidateYears = experienceYears(doc, now);
  const meetsYears = requiredYears === null ? null : candidateYears >= requiredYears;

  const degree = jobDescription.match(/\b(bachelor'?s|master'?s|ph\.?d|doctorate|mba|degree)\b/i);
  const educationText = doc.sections
    .filter((s) => s.visible && s.type === "education")
    .flatMap((s) => s.entries.map((e) => `${e.title} ${e.organization} ${e.description}`))
    .join(" ");
  const educationFound = degree
    ? /bachelor|master|b\.?s\.?c?\b|b\.?a\.?\b|m\.?s\.?c?\b|m\.?a\.?\b|ph\.?d|mba|degree|bfa|mfa|b\.?eng|m\.?eng|diploma/i.test(educationText)
    : null;

  const matched = keywords.filter((k) => k.found);
  const missing = keywords.filter((k) => !k.found);
  const unproven = matched.filter((k) => k.foundIn.length === 1 && k.foundIn[0] === "skills");

  const nextSteps: string[] = [];
  const missingRequired = missing.filter((k) => k.importance === "required");
  if (missingRequired.length) {
    nextSteps.push(
      `If you genuinely have them, add ${missingRequired.slice(0, 4).map((k) => k.name).join(", ")}${missingRequired.length > 4 ? " and others" : ""} to your skills and show them in a bullet.`,
    );
  }
  if (unproven.length) {
    nextSteps.push(
      `Show ${unproven.slice(0, 3).map((k) => k.name).join(", ")} in action: mention where you used ${unproven.length === 1 ? "it" : "them"} in an experience bullet.`,
    );
  }
  if (meetsYears === false) {
    nextSteps.push(
      `The role asks for ${requiredYears}+ years; your dated roles cover about ${candidateYears}. Make sure every relevant role, including freelance or part-time work, has dates.`,
    );
  }
  if (educationFound === false) {
    nextSteps.push("The posting mentions a degree. Add your education, or relevant certifications if you have them.");
  }
  if (!nextSteps.length && keywords.length) {
    nextSteps.push("Strong overlap. Move the most relevant bullets to the top of each role and mirror the posting's wording where it is accurate.");
  }
  if (!keywords.length) {
    nextSteps.push("No recognizable skills found in the posting. Paste the full requirements section for a more useful comparison.");
  }

  return {
    version: RESUME_SCORE_VERSION,
    matchPercent: totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0,
    keywords,
    matched,
    missing,
    unproven,
    years: { required: requiredYears, candidate: candidateYears, meets: meetsYears },
    education: { required: degree ? degree[0] : null, found: educationFound },
    nextSteps,
  };
}
