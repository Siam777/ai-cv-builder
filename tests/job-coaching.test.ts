import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createDocument, newEntry } from "../src/lib/document";
import { reviewJobEvidence } from "../src/lib/vault/job-evidence";
import {
  coachingInput,
  createCoachingProposal,
  JOB_COACH_PROMPT_VERSION,
} from "../src/lib/job-coach";
import { generateSchema } from "../src/lib/ai-contract";
import { jobCoachContext } from "../src/lib/server/job-coach-context";
import { applyReviewedProposal, reviewProposal } from "../src/lib/ai-proposals";
import { generateJobCoaching } from "../src/lib/server/openai-provider";
const target = {
  role: "Product Designer",
  company: "Synthetic",
  seniority: "Not specified",
  language: "english" as const,
};
function fixture(
  source = "Ran customer interviews to understand onboarding friction.",
) {
  const doc = createDocument();
  doc.contact.email = "private-coaching-contact@example.test";
  const bullet = { id: crypto.randomUUID(), text: source };
  doc.sections.find((section) => section.type === "experience")!.entries = [
    { ...newEntry(), title: "Designer", bullets: [bullet] },
  ];
  return { doc, bullet };
}
async function prepared(
  source?: string,
  criterion = "Required: user research",
) {
  const { doc, bullet } = fixture(source);
  const review = await reviewJobEvidence(doc, criterion, target);
  const input = coachingInput(review, review.matches[0].criterion.id);
  const job = await jobCoachContext(doc, bullet.id, input);
  return { doc, bullet, input, job, review };
}
function proposalInput(value: Awaited<ReturnType<typeof prepared>>) {
  return {
    ...value,
    requestId: crypto.randomUUID(),
    bulletId: value.bullet.id,
    model: "controlled-test-reply",
    analyzedAt: new Date().toISOString(),
    draft: {
      text: "Conducted customer interviews about onboarding friction.",
      evidenceIds: [value.bullet.id],
      message: "Review this wording.",
      questions: [],
      assessment: {
        status: "relevant",
        explanation:
          "This entry describes interviews relevant to user research; qualification still needs review.",
        evidenceIds: [value.bullet.id],
      },
    },
    assessmentSupport: { supported: true, reason: "Controlled verdict" },
    rewriteSupport: { supported: true, reason: "Controlled verdict" },
  };
}
test("coaching context reconstructs owned snapshot criteria, priority origin and disclosure bounds", async () => {
  const value = await prepared();
  const request = {
    requestId: crypto.randomUUID(),
    documentId: value.doc.id,
    revision: 0,
    bulletId: value.bullet.id,
    instruction: "Make clearer",
    consent: true,
    job: value.input,
  };
  assert.equal(generateSchema.safeParse(request).success, true);
  assert.equal(
    generateSchema.safeParse({ ...request, consent: false }).success,
    false,
  );
  assert.equal(
    generateSchema.safeParse({
      ...request,
      job: { ...value.input, evidenceIds: ["forged"] },
    }).success,
    false,
  );
  assert.equal(
    generateSchema.safeParse({
      ...request,
      job: { ...value.input, jobText: "x".repeat(20001) },
    }).success,
    false,
  );
  assert.equal("jobText" in value.job, false);
  assert.equal("contact" in value.job, false);
  for (const input of [
    { ...value.input, sourceHash: "0".repeat(64) },
    { ...value.input, jobHash: "0".repeat(64) },
    { ...value.input, criterionId: "invented" },
    { ...value.input, rulesVersion: "old" },
    { ...value.input, target: { ...target, language: "other" as const } },
    { ...value.input, priority: "preferred" as const },
  ])
    await assert.rejects(jobCoachContext(value.doc, value.bullet.id, input));
  const manual = await jobCoachContext(value.doc, value.bullet.id, {
    ...value.input,
    priorityOrigin: "candidate_review",
    priority: "preferred",
  });
  assert.equal(manual.criterion.priorityOrigin, "candidate_review");
  assert.equal(manual.criterion.priority, "preferred");
  value.doc.sections.find((section) => section.type === "experience")!.visible =
    false;
  await assert.rejects(
    jobCoachContext(value.doc, value.bullet.id, value.input),
  );
});
test("controlled coaching replies preserve citations, before/after facts, independent checks and exact undo input", async () => {
  const value = await prepared();
  const input = proposalInput(value);
  const proposal = createCoachingProposal(input);
  assert.equal(proposal.operations.length, 1);
  assert.equal(proposal.coaching?.promptVersion, JOB_COACH_PROMPT_VERSION);
  assert.equal(
    JSON.stringify(proposal).includes(
      value.doc.contact.email || "CONTACT_SENTINEL",
    ),
    false,
  );
  const result = applyReviewedProposal(value.doc, proposal, new Set());
  assert.equal(
    result.document.sections.find((section) => section.type === "experience")!
      .entries[0].bullets[0].text,
    input.draft.text,
  );
  assert.equal(
    value.bullet.text,
    "Ran customer interviews to understand onboarding friction.",
  );
  assert.deepEqual(result.document.contact, value.doc.contact);
  assert.deepEqual(result.document.presentation, value.doc.presentation);
  assert.throws(() =>
    applyReviewedProposal(value.doc, proposal, new Set([proposal.id])),
  );
  assert.throws(() => reviewProposal({ ...value.doc, revision: 1 }, proposal));
  for (const override of [
    { assessmentSupport: null },
    { assessmentSupport: { supported: false, reason: "No support" } },
    { rewriteSupport: { supported: false, reason: "No support" } },
    { rewriteSupport: null },
  ]) {
    const withheld = createCoachingProposal({ ...input, ...override });
    assert.equal(withheld.operations.length, 0);
    assert.equal(withheld.coaching?.assessment.status, "uncertain");
    assert.equal(withheld.questions.length, 1);
  }
  assert.throws(() =>
    createCoachingProposal({
      ...input,
      draft: { ...input.draft, evidenceIds: ["foreign"] },
    }),
  );
  assert.throws(() =>
    createCoachingProposal({
      ...input,
      draft: {
        ...input.draft,
        assessment: { ...input.draft.assessment, evidenceIds: [] },
      },
    }),
  );
  const changed = structuredClone(value.doc);
  changed.sections.find(
    (section) => section.type === "experience",
  )!.entries[0].bullets[0].text = "Changed original";
  assert.throws(() => reviewProposal(changed, proposal));
  assert.throws(() =>
    reviewProposal(value.doc, {
      ...proposal,
      coaching: {
        ...proposal.coaching,
        sources: [...proposal.coaching!.sources, proposal.coaching!.sources[0]],
      },
    }),
  );
});
test("twelve development cases exercise controlled support verdicts without claiming model quality or a held-out gate", async () => {
  const corpus = JSON.parse(
    await readFile("tests/fixtures/job-coaching-development.json", "utf8"),
  );
  assert.equal(corpus.version, "job-coaching-development-v1");
  assert.equal(corpus.cases.length, 12);
  for (const row of corpus.cases) {
    const value = await prepared(row.source, row.criterion);
    const input = proposalInput(value);
    const proposal = createCoachingProposal({
      ...input,
      draft: {
        ...input.draft,
        text: row.text,
        assessment: {
          ...input.draft.assessment,
          status: row.status,
          explanation: "Inspect the original entry for this criterion.",
        },
      },
      assessmentSupport: {
        supported: row.assessmentSupport,
        reason: "Controlled verdict",
      },
      rewriteSupport: {
        supported: row.rewriteSupport,
        reason: "Controlled verdict",
      },
    });
    assert.equal(proposal.operations.length > 0, row.expectedEdit, row.name);
    assert.equal(
      proposal.coaching!.criterion.description,
      value.job.criterion.description,
    );
    assert.equal(value.bullet.text, row.source);
  }
});
function output(value: unknown) {
  return Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(value) }],
      },
    ],
  });
}

test("coaching adapter sends minimal structured context, independently checks claims and fails closed without paid retries", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  try {
    const value = await prepared(
      undefined,
      "Required: user research\nPreferred: Figma\nFULL_POSTING_SENTINEL",
    );
    value.doc.sections.find(
      (section) => section.type === "education",
    )!.entries = [
      {
        ...newEntry(),
        bullets: [{ id: crypto.randomUUID(), text: "OTHER_ENTRY_SENTINEL" }],
      },
    ];
    const original = structuredClone(value.doc);
    const draft = proposalInput(value).draft;
    const bodies: any[] = [],
      signals: AbortSignal[] = [];
    const transport: typeof fetch = async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(options!.body));
      bodies.push(body);
      signals.push(options!.signal!);
      assert.equal(body.store, false);
      assert.equal(body.max_output_tokens, 1800);
      assert.equal(body.text.format.type, "json_schema");
      assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.schema.additionalProperties, false);
      assert.equal(body.tools, undefined);
      assert.equal(body.previous_response_id, undefined);
      assert.equal(options!.cache, "no-store");
      for (const forbidden of [
        value.doc.contact.email,
        "OTHER_ENTRY_SENTINEL",
        "jobText",
        "sourceHash",
        "jobHash",
        "FULL_POSTING_SENTINEL",
      ])
        assert.equal(JSON.stringify(body).includes(forbidden), false);
      return output(
        bodies.length === 1
          ? draft
          : { supported: true, reason: "Controlled audit" },
      );
    };
    const result = await generateJobCoaching(
      value.doc,
      value.bullet.id,
      "Clarify",
      value.job,
      transport,
    );
    assert.equal(bodies.length, 3);
    assert.equal(new Set(signals).size, 1);
    const data = bodies.map((body) => JSON.parse(body.input[0].content));
    assert.deepEqual(data[0].target, value.job.target);
    assert.deepEqual(data[0].criterion, value.job.criterion);
    assert.equal(data[0].instruction, "Clarify");
    assert.deepEqual(data[1].assessment, draft.assessment);
    assert.equal(data[1].proposedText, undefined);
    assert.deepEqual(Object.keys(data[2]).sort(), ["evidence", "proposedText"]);
    assert.equal(data[2].proposedText, draft.text);
    assert.equal(data[2].evidence[0].text, value.bullet.text);
    assert.equal(
      createCoachingProposal({ ...proposalInput(value), ...result }).operations
        .length,
      1,
    );
    assert.deepEqual(value.doc, original);

    for (const scenario of [
      { assessment: false, rewrite: true, calls: 2 },
      { assessment: true, rewrite: false, calls: 3 },
      {
        assessment: true,
        rewrite: true,
        calls: 2,
        text: "Improved onboarding by 97%.",
      },
      {
        assessment: true,
        rewrite: true,
        calls: 2,
        status: "uncertain" as const,
      },
      {
        assessment: true,
        rewrite: true,
        calls: 2,
        status: "not_demonstrated" as const,
      },
    ]) {
      let calls = 0;
      const reply = await generateJobCoaching(
        value.doc,
        value.bullet.id,
        "Clarify",
        value.job,
        async () =>
          output(
            ++calls === 1
              ? {
                  ...draft,
                  text: scenario.text ?? draft.text,
                  assessment: {
                    ...draft.assessment,
                    status: scenario.status ?? "relevant",
                  },
                }
              : {
                  supported:
                    calls === 2 ? scenario.assessment : scenario.rewrite,
                  reason: "Controlled verdict",
                },
          ),
      );
      assert.equal(calls, scenario.calls);
      assert.equal(
        createCoachingProposal({ ...proposalInput(value), ...reply }).operations
          .length,
        0,
      );
    }
    for (const badDraft of [
      { ...draft, evidenceIds: ["foreign"] },
      {
        ...draft,
        assessment: {
          ...draft.assessment,
          evidenceIds: [value.bullet.id, value.bullet.id],
        },
      },
      { ...draft, assessment: { ...draft.assessment, evidenceIds: [] } },
    ]) {
      let calls = 0;
      await assert.rejects(
        generateJobCoaching(
          value.doc,
          value.bullet.id,
          "Clarify",
          value.job,
          async () => {
            calls++;
            return output(badDraft);
          },
        ),
        (error) => (error as { code: string }).code === "AI_INVALID_EVIDENCE",
      );
      assert.equal(calls, 1);
    }
    for (const failAt of [1, 2, 3]) {
      for (const failure of [
        "timeout",
        "http",
        "malformed",
        "refusal",
        "incomplete",
        "oversized",
      ]) {
        let calls = 0;
        await assert.rejects(
          generateJobCoaching(
            value.doc,
            value.bullet.id,
            "Clarify",
            value.job,
            async () => {
              if (++calls !== failAt)
                return output(
                  calls === 1
                    ? draft
                    : { supported: true, reason: "Controlled verdict" },
                );
              if (failure === "timeout")
                throw new DOMException("Controlled", "TimeoutError");
              if (failure === "http") return new Response("", { status: 429 });
              if (failure === "malformed")
                return output({ supported: "invalid" });
              if (failure === "oversized")
                return new Response("x".repeat(100001));
              return Response.json({
                status: failure === "incomplete" ? "incomplete" : "completed",
                output: [
                  {
                    type: "message",
                    content: [
                      { type: "refusal", refusal: "Controlled refusal" },
                    ],
                  },
                ],
              });
            },
          ),
        );
        assert.equal(calls, failAt);
        assert.deepEqual(value.doc, original);
      }
    }
    const duration = await prepared(
      "Conducted interviews.",
      "Required: 5 years of user research",
    );
    let calls = 0;
    const durationDraft = proposalInput(duration).draft;
    const reply = await generateJobCoaching(
      duration.doc,
      duration.bullet.id,
      "Clarify",
      duration.job,
      async () =>
        output(
          ++calls === 1
            ? durationDraft
            : { supported: true, reason: "Controlled verdict" },
        ),
    );
    assert.equal(calls, 2);
    assert.equal(
      createCoachingProposal({ ...proposalInput(duration), ...reply })
        .operations.length,
      0,
    );
  } finally {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});

test("wired coaching uses real account ledger, immutable retries, shared quotas and revision-checked decisions", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  const { database } = await import("../src/lib/server/database");
  const { saveResume, getResume, removeResume } =
    await import("../src/lib/server/resumes");
  const { requestRewrite, decideProposal } =
    await import("../src/lib/server/ai-service");
  const { client } = database();
  try {
    for (const name of (await readdir("migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort())
      await client.executeMultiple(
        await readFile(`migrations/${name}`, "utf8"),
      );
    await client.execute(
      "INSERT INTO user VALUES ('owner','Owner','owner@example.test',1,NULL,0,0),('other','Other','other@example.test',1,NULL,0,0)",
    );
    const value = await prepared();
    const doc = await saveResume("owner", value.doc, null);
    const input = {
      requestId: crypto.randomUUID(),
      documentId: doc.id,
      revision: doc.revision,
      bulletId: value.bullet.id,
      instruction: "Clarify",
      consent: true as const,
      job: value.input,
    };
    // AI job coaching is a Pro feature: refused on Go, before any AI call.
    await client.execute(
      "INSERT INTO subscriptions VALUES ('sub_owner','owner','cus_owner',NULL,'go','active',NULL,0,'2026-01-01','2026-01-01'), ('sub_other','other','cus_other',NULL,'pro','active',NULL,0,'2026-01-01','2026-01-01')",
    );
    await assert.rejects(
      requestRewrite("owner", input),
      (error) => (error as { code: string }).code === "PLAN_REQUIRED",
    );
    await client.execute("UPDATE subscriptions SET plan_id='pro' WHERE user_id='owner'");
    let calls = 0;
    const general = async () => {
      throw new Error("General generator must not handle coaching");
    };
    const coach: typeof generateJobCoaching = async (
      saved,
      bulletId,
      instruction,
      job,
    ) =>
      generateJobCoaching(saved, bulletId, instruction, job, async () => {
        calls++;
        return output(
          calls % 3 === 1
            ? proposalInput(value).draft
            : { supported: true, reason: "Controlled audit" },
        );
      });
    await assert.rejects(requestRewrite("other", input, general, coach));
    await assert.rejects(
      requestRewrite(
        "owner",
        { ...input, consent: false as any },
        general,
        coach,
      ),
    );
    await assert.rejects(
      requestRewrite(
        "owner",
        { ...input, job: { ...input.job, sourceHash: "0".repeat(64) } },
        general,
        coach,
      ),
    );
    assert.equal(calls, 0);
    assert.equal(
      (await client.execute("SELECT * FROM ai_owner_usage")).rows.length,
      0,
    );
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(
      requestRewrite("owner", input, general, coach),
      (error) => (error as { code: string }).code === "AI_NOT_CONFIGURED",
    );
    assert.equal(calls, 0);
    assert.deepEqual(await getResume("owner", doc.id), doc);
    assert.equal(
      (await client.execute("SELECT * FROM ai_requests")).rows.length,
      0,
    );
    assert.equal(
      (await client.execute("SELECT * FROM ai_owner_usage")).rows.length,
      0,
    );
    process.env.OPENAI_API_KEY = "synthetic-test-key";
    const proposal = await requestRewrite("owner", input, general, coach);
    assert.equal(proposal.operations.length, 1);
    assert.equal(proposal.coaching!.promptVersion, JOB_COACH_PROMPT_VERSION);
    assert.deepEqual(await getResume("owner", doc.id), doc);
    assert.deepEqual(
      await requestRewrite("owner", input, general, coach),
      proposal,
    );
    assert.equal(calls, 3);
    for (const changed of [
      { ...input, instruction: "Different" },
      {
        ...input,
        job: {
          ...input.job,
          target: { ...input.job.target, company: "Changed" },
        },
      },
      {
        ...input,
        job: {
          ...input.job,
          priority: "preferred" as const,
          priorityOrigin: "candidate_review" as const,
        },
      },
      { ...input, job: undefined },
    ])
      await assert.rejects(
        requestRewrite("owner", changed, general, coach),
        (error) => (error as { code: string }).code === "AI_REQUEST_CHANGED",
      );
    assert.equal(calls, 3);
    const row = (
      await client.execute({
        sql: "SELECT * FROM ai_requests WHERE id=?",
        args: [input.requestId],
      })
    ).rows[0];
    assert.equal(row.prompt_version, JOB_COACH_PROMPT_VERSION);
    assert.deepEqual(
      JSON.parse(String(row.evidence_snapshot)),
      proposal.coaching!.sources,
    );
    assert.equal(JSON.stringify(row).includes(doc.contact.email), false);
    await assert.rejects(decideProposal("other", proposal.id, "accept"));
    const accepted = await decideProposal("owner", proposal.id, "accept");
    assert.equal(accepted.document!.revision, doc.revision + 1);
    assert.equal(
      (await decideProposal("owner", proposal.id, "accept")).alreadyApplied,
      true,
    );
    const restored = await saveResume(
      "owner",
      { ...doc, revision: accepted.document!.revision },
      accepted.document!.revision,
    );
    const next = {
      ...input,
      requestId: crypto.randomUUID(),
      revision: restored.revision,
      job: coachingInput(
        await reviewJobEvidence(restored, value.input.jobText, target),
        value.input.criterionId,
      ),
    };
    await assert.rejects(
      requestRewrite("owner", next, general, async () => {
        throw new Error("Controlled provider failure");
      }),
    );
    assert.deepEqual(await getResume("owner", doc.id), restored);
    const failed = (
      await client.execute({
        sql: "SELECT status FROM ai_requests WHERE id=?",
        args: [next.requestId],
      })
    ).rows[0];
    assert.equal(failed.status, "failed");
    await assert.rejects(
      requestRewrite("owner", next, general, coach),
      (error) => (error as { code: string }).code === "AI_FINISHED",
    );
    process.env.AI_DAILY_USER_LIMIT = "2";
    await assert.rejects(
      requestRewrite(
        "owner",
        { ...next, requestId: crypto.randomUUID() },
        general,
        coach,
      ),
      (error) => (error as { code: string }).code === "AI_LIMIT",
    );
    delete process.env.AI_DAILY_USER_LIMIT;
    process.env.AI_DAILY_GLOBAL_LIMIT = "2";
    await assert.rejects(
      requestRewrite(
        "owner",
        { ...next, requestId: crypto.randomUUID() },
        general,
        coach,
      ),
      (error) => (error as { code: string }).code === "AI_LIMIT",
    );
    delete process.env.AI_DAILY_GLOBAL_LIMIT;
    for (let index = 0; index < 2; index++)
      await client.execute({
        sql: "INSERT INTO ai_requests(owner_id,id,resume_id,request_hash,base_revision,status,created_at,expires_at) VALUES ('owner',?,?,?,?,'generating',?,?)",
        args: [
          `active-${index}`,
          doc.id,
          `active-hash-${index}`,
          restored.revision,
          Date.now(),
          Date.now() + 86400000,
        ],
      });
    await assert.rejects(
      requestRewrite(
        "owner",
        { ...next, requestId: crypto.randomUUID() },
        general,
        coach,
      ),
      (error) => (error as { code: string }).code === "AI_BUSY",
    );
    assert.equal(calls, 3);
    await client.execute(
      "DELETE FROM ai_requests WHERE owner_id='owner' AND id IN ('active-0','active-1')",
    );
    const stale = { ...next, requestId: crypto.randomUUID() };
    await assert.rejects(
      requestRewrite("owner", stale, general, async (...args) => {
        const result = await coach(...args);
        await saveResume("owner", restored, restored.revision);
        return result;
      }),
      (error) => (error as { code: string }).code === "AI_STALE",
    );
    const latest = await getResume("owner", doc.id);
    const rejectable = await requestRewrite(
      "owner",
      {
        ...next,
        requestId: crypto.randomUUID(),
        revision: latest.revision,
        job: coachingInput(
          await reviewJobEvidence(latest, value.input.jobText, target),
          value.input.criterionId,
        ),
      },
      general,
      coach,
    );
    await decideProposal("owner", rejectable.id, "reject");
    const rejected = (
      await client.execute({
        sql: "SELECT proposal,evidence_snapshot FROM ai_requests WHERE id=?",
        args: [rejectable.id],
      })
    ).rows[0];
    assert.equal(rejected.proposal, null);
    assert.equal(rejected.evidence_snapshot, null);
    await removeResume("owner", doc.id, latest.revision);
    assert.equal(
      (await client.execute("SELECT * FROM ai_requests")).rows.length,
      0,
    );
    assert.equal(
      Number(
        (
          await client.execute(
            "SELECT count FROM ai_owner_usage WHERE owner_id='owner'",
          )
        ).rows[0].count,
      ),
      4,
    );
  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_DAILY_USER_LIMIT;
    delete process.env.AI_DAILY_GLOBAL_LIMIT;
  }
});
