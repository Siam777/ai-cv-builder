import { loadEnvConfig } from "@next/env";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  corpusSchema,
  prepareCase,
  evaluateCase,
  evaluationIdentity,
  evaluationSummary,
  type CaseResult,
} from "./lib/job-coaching-evaluation";
import { openAIConfigured } from "../src/lib/server/openai-provider";

async function main() {
  loadEnvConfig(process.cwd());
  const args = process.argv.slice(2);
  if (
    args.some(
      (arg) =>
        arg !== "--live" && arg !== "--dry-run" && !/^--limit=\d+$/.test(arg),
    )
  )
    throw new Error("Use --dry-run or --live with --limit=1..24.");
  if (args.includes("--live") && args.includes("--dry-run"))
    throw new Error("Choose one evaluation mode.");
  const live = args.includes("--live");
  const limit = Number(
    args.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 12,
  );
  if (!Number.isInteger(limit) || limit < 1 || limit > 24)
    throw new Error("Limit must be 1..24.");
  const corpus = corpusSchema.parse(
    JSON.parse(
      await readFile(
        "tests/fixtures/job-coaching-live-development.json",
        "utf8",
      ),
    ),
  );
  const selected = corpus.cases.slice(0, limit);
  if (!live) {
    let prepared = 0,
      abstained = 0;
    for (const row of selected) {
      try {
        await prepareCase(row);
        prepared++;
      } catch (error) {
        if ((error as { code?: string }).code === row.expected.abstentionCode)
          abstained++;
        else throw error;
      }
    }
    console.log(
      JSON.stringify({
        ...evaluationIdentity(corpus),
        mode: "dry-run",
        selected: selected.length,
        prepared,
        expectedAbstentions: abstained,
        providerCalls: 0,
        releaseGatePassed: false,
      }),
    );
    return;
  }
  if (!openAIConfigured())
    throw new Error(
      "Set OPENAI_API_KEY privately in .env.local before a live run.",
    );
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(
    "test-results",
    "job-coaching-evaluations",
    `${runId}.json`,
  );
  const results: CaseResult[] = [];
  const report = {
    ...evaluationIdentity(corpus),
    runId,
    startedAt: new Date().toISOString(),
    mode: "live",
    selectedCaseIds: selected.map((row) => row.id),
    limits: {
      cases: limit,
      providerCalls: limit * 3,
      outputTokensPerCall: 1800,
      deadlinePerCaseMs: 45000,
      retries: 0,
    },
    expectations: selected.map((row) => ({
      id: row.id,
      expected: row.expected,
    })),
    results,
    summary: evaluationSummary(results),
    stopReason: null as string | null,
  };
  await mkdir(dirname(path), { recursive: true });
  console.log(
    `Live synthetic development evaluation: ${limit} cases, at most ${limit * 3} calls. Report: ${path}`,
  );
  for (const row of selected) {
    const result = await evaluateCase(row);
    results.push(result);
    report.summary = evaluationSummary(results);
    // A connection/auth/quota failure is operational: stop rather than spend on the remaining cases.
    if (result.errorCode === "AI_UNAVAILABLE")
      report.stopReason = "provider-unavailable";
    if (result.errorCode === "AI_PROVIDER_AUTH")
      report.stopReason = "provider-authentication";
    await writeFile(`${path}.tmp`, JSON.stringify(report, null, 2) + "\n");
    await rename(`${path}.tmp`, path);
    console.log(
      JSON.stringify({
        id: result.id,
        outcome: result.outcome,
        calls: result.providerCalls,
        durationMs: result.durationMs,
        errorCode: result.errorCode,
      }),
    );
    if (report.stopReason) break;
  }
  console.log(JSON.stringify(report.summary));
  console.log(
    "Development checks require semantic human review. The held-out release gate remains open.",
  );
  if (
    report.summary.errors ||
    report.summary.checksFailed ||
    results.length !== selected.length
  )
    process.exitCode = 1;
}
void main().catch(() => {
  // Never print environment values or raw provider errors/responses.
  console.error(
    "Evaluation setup failed. Check arguments, fixture validation and private OpenAI configuration.",
  );
  process.exitCode = 1;
});
