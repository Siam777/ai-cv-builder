import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import { bulletEvidence } from "../src/lib/ai-proposals";
import { generateRewrite } from "../src/lib/server/openai-provider";

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
test("OpenAI adapter uses bounded structured requests and keeps unsupported claims out of proposals (controlled responses)", async () => {
  const old = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  try {
    const doc = createDocument(true);
    const evidence = bulletEvidence(doc)[0];
    const draft = {
      text: "Worked with the product design team.",
      evidenceIds: [evidence.id],
      message: "Review this suggestion.",
      questions: [],
    };
    let calls = 0;
    const transport: typeof fetch = async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(options!.body));
      assert.equal(body.store, false);
      assert.equal(body.max_output_tokens, 1800);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.tools, undefined);
      assert.ok(options!.signal);
      assert.ok(!JSON.stringify(body).includes(doc.contact.email));
      return output(
        ++calls === 1
          ? draft
          : { supported: true, reason: "Supported by the source." },
      );
    };
    const result = await generateRewrite(
      doc,
      evidence.id,
      "Make this concise",
      transport,
    );
    assert.equal(result.text, draft.text);
    assert.equal(calls, 2);
    calls = 0;
    const metric = await generateRewrite(
      doc,
      evidence.id,
      "Invent a metric",
      async () => {
        calls++;
        return output({ ...draft, text: "Improved conversion by 97%." });
      },
    );
    assert.equal(metric.text, "");
    assert.equal(calls, 1);
    calls = 0;
    const skill = await generateRewrite(
      doc,
      evidence.id,
      "Add Kubernetes",
      async () =>
        output(
          ++calls === 1
            ? { ...draft, text: "Led Kubernetes operations." }
            : { supported: false, reason: "No Kubernetes evidence." },
        ),
    );
    assert.equal(skill.text, "");
    assert.equal(calls, 2);
    await assert.rejects(
      generateRewrite(doc, evidence.id, "Rewrite", async () =>
        output({ ...draft, evidenceIds: ["another-user-fact"] }),
      ),
    );
    await assert.rejects(
      generateRewrite(doc, evidence.id, "Rewrite", async () => {
        throw new DOMException("Timed out", "TimeoutError");
      }),
    );
    await assert.rejects(
      generateRewrite(doc, evidence.id, "Rewrite", async () =>
        Response.json({ status: "incomplete", output: [] }),
      ),
    );
    await assert.rejects(
      generateRewrite(doc, evidence.id, "Rewrite", async () =>
        output({ unexpected: "malformed" }),
      ),
    );
    await assert.rejects(
      generateRewrite(doc, evidence.id, "Rewrite", async () =>
        Response.json({
          status: "completed",
          output: [
            { type: "message", content: [{ type: "refusal", refusal: "No" }] },
          ],
        }),
      ),
    );
    assert.equal(bulletEvidence(doc)[0].text, evidence.text);
  } finally {
    if (old === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = old;
  }
});
