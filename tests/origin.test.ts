import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOrigin, requireSameOrigin } from "../src/lib/server/http";

const site = "https://cv-builder.elfasyssolution.com";

test("APP_ORIGIN is reduced to scheme and host whatever the env file adds", () => {
  for (const raw of [
    site,
    `${site}\r`,
    `${site}/`,
    ` "${site}/" `,
    `'${site}'`,
    `${site}/profile?x=1`,
    `HTTPS://CV-BUILDER.ELFASYSSOLUTION.COM`,
  ])
    assert.equal(normalizeOrigin(raw), site, JSON.stringify(raw));
  assert.equal(normalizeOrigin("http://localhost:3000/"), "http://localhost:3000");
  assert.equal(normalizeOrigin(""), "");
  assert.equal(normalizeOrigin(undefined), "");
  assert.equal(normalizeOrigin("cv-builder.elfasyssolution.com"), "");
  assert.equal(normalizeOrigin("ftp://example.com"), "");
});

test("the same-origin check accepts the site and still rejects others", () => {
  const request = (origin: string, site = "same-origin") =>
    new Request(`${site === "x" ? "" : "http://127.0.0.1:3000"}/api/account`, {
      method: "PATCH",
      headers: { origin, "sec-fetch-site": site },
    });
  assert.doesNotThrow(() => requireSameOrigin(request(site), normalizeOrigin(`${site}\r`)));
  assert.throws(() => requireSameOrigin(request("https://evil.example"), normalizeOrigin(site)));
  assert.throws(() => requireSameOrigin(request(site, "cross-site"), normalizeOrigin(site)));
});
