import test from "node:test";
import assert from "node:assert/strict";
import {
  emailDeliveryMode,
  requireEmailDelivery,
  sendAuthEmail,
} from "../src/lib/server/auth-email";

test("email delivery fails closed without configuration, disables file delivery in production, and bounds provider requests", async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.AUTH_EMAIL_MODE;
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    assert.equal(emailDeliveryMode(), "unconfigured");
    assert.throws(requireEmailDelivery, /not configured/);
    Object.assign(process.env, {
      AUTH_EMAIL_MODE: "file",
      NODE_ENV: "production",
    });
    assert.equal(emailDeliveryMode(), "unconfigured");
    Object.assign(process.env, {
      RESEND_API_KEY: "synthetic-key",
      AUTH_EMAIL_FROM: "CV <cv@example.test>",
    });
    assert.equal(emailDeliveryMode(), "resend");
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      const body = JSON.parse(options!.body as string);
      assert.deepEqual(body.to, ["user@example.test"]);
      assert.match(body.text, /30 minutes/);
      assert.ok(options!.signal);
      return new Response(JSON.stringify({ id: "fixture" }), { status: 200 });
    };
    await sendAuthEmail(
      "user@example.test",
      "https://app.example.test/recover",
      "recovery",
    );
    globalThis.fetch = async () =>
      new Response("private-provider-error", { status: 500 });
    await assert.rejects(
      sendAuthEmail(
        "user@example.test",
        "https://app.example.test/verify",
        "verification",
      ),
      /Email could not be sent/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of [
      "AUTH_EMAIL_MODE",
      "RESEND_API_KEY",
      "AUTH_EMAIL_FROM",
      "NODE_ENV",
    ]) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
