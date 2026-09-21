import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument } from "../../src/lib/document";
const origin = "http://localhost:3000";
const testIp = () => `192.0.2.${Math.floor(Math.random() * 250) + 1}`;
const password = "Synthetic-account-password-42";
async function signup(client: APIRequestContext) {
  const email = `test-${randomUUID()}@example.test`;
  const response = await client.post("/api/auth", {
    headers: { origin },
    data: { action: "signup", email, password },
  });
  expect(response.status(), await response.text()).toBe(200);
  const session = await (await client.get("/api/account")).json();
  expect(session.user.email).toBe(email);
  return {
    user: session.user,
    headers: { origin, "X-Workspace-User": session.user.id },
  };
}
test("real SQLite accounts isolate reads, writes, exports, imports and deletion", async ({
  playwright,
}) => {
  const alice = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { "x-forwarded-for": testIp() },
  });
  const bob = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { "x-forwarded-for": testIp() },
  });
  const anon = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { "x-forwarded-for": testIp() },
  });
  const a = await signup(alice);
  const b = await signup(bob);
  try {
    const doc = createDocument(true);
    expect((await anon.get("/api/resumes")).status()).toBe(401);
    expect(
      (
        await alice.post("/api/resumes", {
          headers: { ...a.headers, origin: "https://untrusted.example" },
          data: { document: doc, expectedRevision: null },
        })
      ).status(),
    ).toBe(403);
    const created = await alice.post("/api/resumes", {
      headers: a.headers,
      data: { document: doc, expectedRevision: null },
    });
    expect(created.status(), await created.text()).toBe(200);
    const saved = await created.json();
    expect(saved.revision).toBe(0);
    expect(
      (
        await bob.get(`/api/resumes/${doc.id}`, { headers: b.headers })
      ).status(),
    ).toBe(404);
    expect(
      (
        await bob.post("/api/resumes", {
          headers: b.headers,
          data: { document: doc, expectedRevision: 0 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await bob.delete(`/api/resumes/${doc.id}`, {
          headers: b.headers,
          data: { expectedRevision: 0 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (await bob.get("/api/account/export", { headers: a.headers })).status(),
    ).toBe(409);
    expect(
      (
        await (
          await bob.get("/api/account/export", { headers: b.headers })
        ).json()
      ).resumes,
    ).toEqual([]);
    const writes = await Promise.all(
      [1, 2].map((n) =>
        alice.post("/api/resumes", {
          headers: a.headers,
          data: {
            document: { ...doc, name: `Variant ${n}` },
            expectedRevision: 0,
          },
        }),
      ),
    );
    expect(writes.map((r) => r.status()).sort()).toEqual([200, 409]);
    expect(
      (
        await alice.delete(`/api/resumes/${doc.id}`, {
          headers: a.headers,
          data: { expectedRevision: 0 },
        })
      ).status(),
    ).toBe(409);
    const source = createDocument(true);
    const imports = await Promise.all(
      [1, 2].map(() =>
        alice.post("/api/resumes/import", {
          headers: a.headers,
          data: { documents: [source] },
        }),
      ),
    );
    for (const response of imports)
      expect(response.status(), await response.text()).toBe(200);
    const first = (await imports[0].json())[0];
    const second = (await imports[1].json())[0];
    expect(first.resumeId).toBe(second.resumeId);
    expect(first.resumeId).not.toBe(source.id);
    expect([first.status, second.status].sort()).toEqual([
      "already_imported",
      "imported",
    ]);
    const malformed = await alice.post("/api/resumes/import", {
      headers: a.headers,
      data: {
        documents: [
          createDocument(),
          { ...createDocument(), schemaVersion: 999 },
        ],
      },
    });
    expect(malformed.status()).toBe(400);
    expect(
      await (await alice.get("/api/resumes", { headers: a.headers })).json(),
    ).toHaveLength(2);
    expect(
      (
        await alice.delete(`/api/resumes/${first.resumeId}`, {
          headers: a.headers,
          data: { expectedRevision: 0 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await (
          await alice.post("/api/resumes/import", {
            headers: a.headers,
            data: { documents: [source] },
          })
        ).json()
      )[0].status,
    ).toBe("already_imported");
    expect(
      (
        await alice.delete("/api/account", {
          headers: a.headers,
          data: { password: "wrong", confirmation: "DELETE MY ACCOUNT" },
        })
      ).ok(),
    ).toBe(false);
    const exported = await alice.get("/api/account/export", {
      headers: a.headers,
    });
    expect(exported.headers()["cache-control"]).toContain("no-store");
    const data = await exported.json();
    expect(data.resumes).toHaveLength(1);
    expect(data.imports).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain(password);
    const changedPassword = "Changed-synthetic-password-43";
    expect(
      (
        await alice.post("/api/account/password", {
          headers: a.headers,
          data: { password: changedPassword, currentPassword: "incorrect" },
        })
      ).ok(),
    ).toBe(false);
    expect(
      (
        await alice.post("/api/account/password", {
          headers: a.headers,
          data: { password: changedPassword, currentPassword: password },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await alice.post("/api/auth", {
          headers: { origin },
          data: { action: "signout" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await alice.post("/api/auth", {
          headers: { origin },
          data: { action: "signin", email: a.user.email, password },
        })
      ).ok(),
    ).toBe(false);
    expect(
      (
        await alice.post("/api/auth", {
          headers: { origin },
          data: {
            action: "signin",
            email: a.user.email,
            password: changedPassword,
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await alice.post("/api/account/password", {
          headers: a.headers,
          data: { password, currentPassword: changedPassword },
        })
      ).status(),
    ).toBe(200);
    const deleted = await alice.delete("/api/account", {
      headers: a.headers,
      data: { password, confirmation: "DELETE MY ACCOUNT" },
    });
    expect(deleted.status(), await deleted.text()).toBe(200);
    expect(
      (await alice.get("/api/resumes", { headers: a.headers })).status(),
    ).toBe(401);
    // Re-registering the email yields an empty account; old data cannot be recovered by reuse.
    expect(
      (
        await alice.post("/api/auth", {
          headers: { origin },
          data: { action: "signup", email: a.user.email, password },
        })
      ).status(),
    ).toBe(200);
    const newUser = (await (await alice.get("/api/account")).json()).user;
    expect(newUser.id).not.toBe(a.user.id);
    expect(
      await (
        await alice.get("/api/resumes", {
          headers: { ...a.headers, "X-Workspace-User": newUser.id },
        })
      ).json(),
    ).toEqual([]);
    a.headers["X-Workspace-User"] = newUser.id;
  } finally {
    for (const [client, account] of [
      [alice, a],
      [bob, b],
    ] as const)
      await client.delete("/api/account", {
        headers: account.headers,
        data: { password, confirmation: "DELETE MY ACCOUNT" },
      });
    await alice.dispose();
    await bob.dispose();
    await anon.dispose();
  }
});

test("account UI explicitly copies local resumes and returns to local after deletion", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": testIp() });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore an example" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved on this device");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Create account instead" }).click();
  await page
    .locator(".account-panel")
    .getByLabel("Email", { exact: true })
    .fill(`ui-${randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open account workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open account workspace" }).click();
  await expect(page.locator("#resume-select")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Review local resumes for import" })
    .click();
  const copy = page.getByRole("button", { name: "Copy 0 selected to account" });
  await expect(copy).toBeDisabled();
  await page.locator(".transfer-row input").check();
  await page
    .getByRole("button", { name: "Copy 1 selected to account" })
    .click();
  await expect(page.locator(".account-message")).toContainText(
    "1 resumes copied",
  );
  await page.screenshot({
    path: "test-results/account-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close account settings" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Account copy");
  await expect(page.getByRole("status")).toHaveText("Saved to your account");
  await page.route("**/api/resumes", (route) => route.abort());
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Unsaved account draft");
  await expect(page.locator(".save-status")).toHaveText("Save failed");
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Unsaved account draft",
  );
  const recovery = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download recovery backup" }).click();
  await recovery;
  await page.unroute("**/api/resumes");
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.locator(".save-status")).toHaveText(
    "Saved to your account",
  );
  await page.getByLabel("Full name", { exact: true }).fill("Account copy");
  await expect(page.locator(".save-status")).toHaveText(
    "Saved to your account",
  );
  await page.reload();
  // Browser data remains the default workspace on every fresh load.
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Open account workspace" }).click();
  await page.getByRole("button", { name: "Close account settings" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Account copy",
  );
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete account and cloud resumes" })
    .click();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("Type DELETE MY ACCOUNT").fill("DELETE MY ACCOUNT");
  await page
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  await expect(page.locator(".account-message")).toContainText("deleted");
  await page.getByRole("button", { name: "Close account settings" }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
});
