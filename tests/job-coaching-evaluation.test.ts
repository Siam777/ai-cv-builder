import test from "node:test";
import assert from "node:assert/strict";
import fixtureCorpus from "./fixtures/job-coaching-live-development.json";
import {
  corpusSchema,
  evaluateCase,
  evaluationIdentity,
  evaluationSummary,
  prepareCase,
} from "../scripts/lib/job-coaching-evaluation";

const corpus = corpusSchema.parse(fixtureCorpus);
function output(value: unknown) {
  return Response.json({
    status: "completed",
    model: "controlled-model",
    usage: { input_tokens: 100, output_tokens: 20 },
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(value) }],
      },
    ],
  });
}

test("development corpus is balanced across six groups, versioned, synthetic and locally valid with separate abstention", async () => {
  assert.equal(corpus.cases.length, 24);
  assert.equal(corpus.cases.filter((row) => row.expected.allowEdit).length, 12);
  assert.equal(
    new Set(corpus.cases.slice(0, 12).map((row) => row.group)).size,
    6,
  );
  for (const row of corpus.cases) {
    if (row.expected.abstentionCode)
      await assert.rejects(
        prepareCase(row),
        (error) =>
          (error as { code: string }).code === row.expected.abstentionCode,
      );
    else {
      const prepared = await prepareCase(row);
      assert.ok(prepared.job.criterion.description);
      assert.equal("jobText" in prepared.job, false);
    }
  }
  assert.equal(
    corpusSchema.safeParse({ ...corpus, split: "held-out" }).success,
    false,
  );
  assert.equal(
    corpusSchema.safeParse({
      ...corpus,
      cases: [corpus.cases[0], corpus.cases[0]],
    }).success,
    false,
  );
  assert.equal(evaluationIdentity(corpus).corpusHash.length, 64);
  assert.notEqual(
    evaluationIdentity(corpus).corpusHash,
    evaluationIdentity({ ...corpus, version: "changed" }).corpusHash,
  );
});

test("evaluation preserves raw versus final failures, prevents all-abstain success and reports usage without claiming quality", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-evaluation-key";
  try {
    const fixture = corpus.cases[0];
    const draft = {
      text: fixture.bullets[0],
      evidenceIds: ["source-0"],
      message: "Inspect this wording.",
      questions: [],
      assessment: {
        status: "relevant",
        explanation: "Applied experience is recorded.",
        evidenceIds: ["source-0"],
      },
    };
    let calls = 0;
    const successful = await evaluateCase(fixture, async () =>
      output(
        ++calls === 1
          ? draft
          : { supported: true, reason: "Controlled support" },
      ),
    );
    assert.equal(successful.outcome, "checks-passed");
    assert.equal(calls, 3);
    assert.equal(successful.inputTokens, 300);
    assert.equal(successful.outputTokens, 60);
    assert.equal(successful.humanReview, "pending");
    assert.deepEqual(successful.providerModels, ["controlled-model"]);

    calls = 0;
    const abstained = await evaluateCase(fixture, async () =>
      output(
        ++calls === 1
          ? {
              ...draft,
              text: "",
              evidenceIds: [],
              assessment: {
                ...draft.assessment,
                status: "uncertain",
                evidenceIds: [],
              },
            }
          : { supported: true, reason: "Controlled uncertainty" },
      ),
    );
    assert.equal(abstained.outcome, "checks-failed");
    assert.equal(abstained.checks!.assessmentAgreement, false);
    assert.equal(abstained.final!.text, "");

    calls = 0;
    const masked = await evaluateCase(corpus.cases[1], async () =>
      output(
        ++calls === 1
          ? draft
          : { supported: false, reason: "Unsupported Kubernetes" },
      ),
    );
    assert.equal(masked.final!.text, "");
    assert.equal(masked.checks!.assessmentAgreement, true);
    assert.equal(masked.checks!.rawAssessmentAgreement, false);
    assert.equal(masked.outcome, "checks-failed");
    const summary = evaluationSummary([successful, abstained, masked]);
    assert.deepEqual(summary.finalAssessmentAgreement, {
      numerator: 2,
      denominator: 3,
    });
    assert.deepEqual(summary.rawAssessmentAgreement, {
      numerator: 1,
      denominator: 3,
    });
    assert.equal(summary.releaseGatePassed, false);
    assert.equal(summary.semanticSupport, "pending independent human review");

    const otherLanguage = await evaluateCase(corpus.cases.at(-1)!, async () => {
      throw new Error("Must not call provider");
    });
    assert.equal(otherLanguage.outcome, "expected-abstention");
    assert.equal(otherLanguage.providerCalls, 0);
    const failed = await evaluateCase(
      fixture,
      async () => new Response("DO_NOT_LOG_THIS_BODY", { status: 429 }),
    );
    assert.equal(failed.outcome, "provider-or-validation-failure");
    assert.equal(failed.providerCalls, 1);
    assert.equal(failed.errorCode, "AI_UNAVAILABLE");
    assert.equal(JSON.stringify(failed).includes("DO_NOT_LOG"), false);
    assert.equal(
      evaluationSummary([failed]).finalAssessmentAgreement.denominator,
      0,
    );
    const denied = await evaluateCase(
      fixture,
      async () => new Response("DO_NOT_LOG_CREDENTIAL_ERROR", { status: 401 }),
    );
    assert.equal(denied.errorCode, "AI_PROVIDER_AUTH");
    assert.deepEqual(denied.httpStatuses, [401]);
    assert.equal(denied.providerCalls, 1);
    assert.equal(JSON.stringify(denied).includes("DO_NOT_LOG"), false);
  } finally {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});
