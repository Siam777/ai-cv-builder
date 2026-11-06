/**
 * Argument parsing for npm run ai:eval, kept apart from the script so tests
 * can check it without importing the script (which makes paid calls).
 */
export const SUITES = [
  "rewrite",
  "entry",
  "starters",
  "skills",
  "interview",
  "match",
  "improve",
  "letter",
  "tidy",
  "ask",
  "job-read",
] as const;
export type Suite = (typeof SUITES)[number];

/** Parses --suite=a,b and --save. Throws on anything else, before any paid call. */
export function parseEvalArgs(args: string[]) {
  const suiteArg = args.find((arg) => arg.startsWith("--suite="));
  if (args.some((arg) => arg !== "--save" && arg !== suiteArg))
    throw new Error(
      `Use --suite=${SUITES.join(",")} (default: all) and optionally --save.`,
    );
  const suites = (suiteArg?.split("=")[1].split(",") ?? [...SUITES]) as Suite[];
  if (!suites.length || suites.some((suite) => !SUITES.includes(suite)))
    throw new Error(`Unknown suite. Choose from ${SUITES.join(", ")}.`);
  return { suites, save: args.includes("--save") };
}
