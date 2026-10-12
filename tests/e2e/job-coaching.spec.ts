import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { createDocument } from "../../src/lib/document";
import { bulletEvidence, proposalSchema } from "../../src/lib/ai-proposals";
import { generateSchema } from "../../src/lib/ai-contract";
import { createCoachingProposal } from "../../src/lib/job-coach";
import { jobCoachContext } from "../../src/lib/server/job-coach-context";
import { authenticateForExport, openFirstCv, openEditorTools } from "./helpers";
const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const consent =
  "Send this criterion, target context, entry bullets and instruction to OpenAI.";
const sourceText = "Ran customer interviews to understand onboarding friction.";
const rewrite = "Conducted customer interviews about onboarding friction.";
async function setup(page: Page) {
  await page.goto("/builder");
  const owner = await authenticateForExport(page);
  const fixture = createDocument(true);
  fixture.provenance = { purpose: "personal", origin: "import" };
  fixture.sections
    .flatMap((section) => section.entries)
    .find((entry) => entry.bullets.length)!.bullets[0].text = sourceText;
  const response = await page.request.post("/api/resumes", {
    headers: { origin, "X-Workspace-User": owner.id },
    data: { document: fixture, expectedRevision: null },
  });
  expect(response.ok()).toBe(true);
  const doc = await response.json();
  await page.evaluate(() => sessionStorage.setItem("cv-workspace", "account"));
  await page.reload();
  await openFirstCv(page);
  return { owner, doc, headers: { origin, "X-Workspace-User": owner.id } };
}
async function openCoach(page: Page) {
  await openEditorTools(page);
  await page.getByRole("button", { name: "🎯 Tailor for job" }).click();
  await page.getByLabel("Target Job Title").fill("Product Designer");
  await page
    .getByLabel("Job Description", { exact: true })
    .fill("Required: user research");
  await page.getByLabel("Use this target role, seniority and language").check();
  await page.getByRole("button", { name: "Analyze & Match Evidence" }).click();
  await page
    .getByRole("button", {
      name: "Coach criterion: Required: user research",
      exact: true,
    })
    .click();
  return page.getByRole("region", { name: "Job criterion coaching" });
}
// Browser-injected controlled replies. The opt-in transport cases below instead
// exercise the real server generator, with every OpenAI request intercepted locally.
// Real SQLite proposal decisions, revisions, account export and undo remain in use.
async function controlledReplies(
  page: Page,
  owner: string,
  options: { withheld?: boolean; loseResponse?: boolean } = {},
) {
  const ids: string[] = [];
  let calls = 0,
    lose = !!options.loseResponse;
  await page.route("**/api/ai", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          configured: true,
          signedIn: true,
          jobCoaching: true,
          provider: "OpenAI",
        },
      });
    const input = generateSchema.parse(route.request().postDataJSON());
    expect(input.consent).toBe(true);
    expect(input.job).toBeDefined();
    expect((input as any).document).toBeUndefined();
    ids.push(input.requestId);
    const client = createClient({ url: "file:./data/e2e.db" });
    let proposal;
    try {
      const prior = (
        await client.execute({
          sql: "SELECT proposal FROM ai_requests WHERE owner_id=? AND id=?",
          args: [owner, input.requestId],
        })
      ).rows[0];
      if (prior)
        proposal = proposalSchema.parse(JSON.parse(String(prior.proposal)));
      else {
        calls++;
        const doc = await (
          await page.request.get(`/api/resumes/${input.documentId}`, {
            headers: { "X-Workspace-User": owner },
          })
        ).json();
        const job = await jobCoachContext(doc, input.bulletId, input.job!);
        proposal = createCoachingProposal({
          doc,
          requestId: input.requestId,
          bulletId: input.bulletId,
          job,
          model: "controlled-test-reply",
          analyzedAt: new Date().toISOString(),
          draft: {
            text: rewrite,
            evidenceIds: [input.bulletId],
            message: "Controlled coaching suggestion",
            questions: [],
            assessment: {
              status: "relevant",
              explanation:
                "The entry describes customer interviews relevant to this criterion. Qualification still requires review.",
              evidenceIds: [input.bulletId],
            },
          },
          assessmentSupport: {
            supported: !options.withheld,
            reason: "Controlled support reply",
          },
          rewriteSupport: {
            supported: !options.withheld,
            reason: "Controlled support reply",
          },
        });
        await client.execute({
          sql: "INSERT INTO ai_requests(owner_id,id,resume_id,request_hash,base_revision,status,proposal,evidence_snapshot,prompt_version,model,created_at,expires_at) VALUES (?,?,?,?,?,'review',?,?,?,?,?,?)",
          args: [
            owner,
            input.requestId,
            doc.id,
            "controlled-test-only",
            doc.revision,
            JSON.stringify(proposal),
            JSON.stringify(proposal.coaching!.sources),
            proposal.coaching!.promptVersion,
            proposal.coaching!.model,
            Date.now(),
            Date.now() + 86400000,
          ],
        });
      }
    } finally {
      client.close();
    }
    if (lose) {
      lose = false;
      return route.abort("failed");
    }
    await route.fulfill({ json: proposal });
  });
  return { ids, calls: () => calls };
}

test("unavailable job coaching is explicit and cannot generate, charge usage or change the local review", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_OPENAI === "1",
    "Run with the unconfigured isolated server",
  );
  const { doc, headers } = await setup(page);
  const coach = await openCoach(page);
  await expect(coach).toContainText("Live job coaching is not enabled");
  await expect(
    coach.getByRole("button", { name: "Request criterion coaching" }),
  ).toHaveCount(0);
  await coach.getByRole("button", { name: "Close criterion coaching" }).click();
  await expect(
    page.getByRole("region", { name: "Requirement coverage" }),
  ).toBeVisible();
  const current = await (
    await page.request.get(`/api/resumes/${doc.id}`, { headers })
  ).json();
  expect(current).toEqual(doc);
  const client = createClient({ url: "file:./data/e2e.db" });
  try {
    expect(
      (
        await client.execute({
          sql: "SELECT * FROM ai_requests WHERE owner_id=?",
          args: [headers["X-Workspace-User"]],
        })
      ).rows,
    ).toHaveLength(0);
  } finally {
    client.close();
  }
});

test("configured coaching uses the real adapter and ledger, recovers a lost response, saves once and supports Undo", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_OPENAI !== "1",
    "Requires isolated synthetic provider transport",
  );
  const { doc, headers } = await setup(page);
  expect(await (await page.request.get("/api/ai")).json()).toMatchObject({
    configured: true,
    jobCoaching: true,
    signedIn: true,
  });
  let lose = true;
  const ids: string[] = [];
  await page.route("**/api/ai", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    ids.push(route.request().postDataJSON().requestId);
    const response = await route.fetch();
    expect(response.ok(), await response.text()).toBe(true);
    if (lose) {
      lose = false;
      return route.abort("failed");
    }
    return route.fulfill({ response });
  });
  const coach = await openCoach(page);
  const generate = coach.getByRole("button", {
    name: "Request criterion coaching",
  });
  await expect(generate).toBeDisabled();
  await coach.getByLabel(consent).check();
  await generate.click();
  await expect(coach.getByRole("alert")).toContainText(
    "Could not reach account storage",
  );
  await generate.click();
  const proposal = coach.getByRole("article", { name: "Coaching proposal" });
  await expect(proposal).toContainText(rewrite);
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  expect(
    await (
      await page.request.get(`/api/resumes/${doc.id}`, { headers })
    ).json(),
  ).toEqual(doc);
  const client = createClient({ url: "file:./data/e2e.db" });
  try {
    const usage = (
      await client.execute({
        sql: "SELECT count FROM ai_owner_usage WHERE owner_id=?",
        args: [headers["X-Workspace-User"]],
      })
    ).rows;
    expect(Number(usage[0].count)).toBe(1);
    expect(
      (
        await client.execute({
          sql: "SELECT * FROM ai_requests WHERE owner_id=?",
          args: [headers["X-Workspace-User"]],
        })
      ).rows,
    ).toHaveLength(1);
  } finally {
    client.close();
  }
  await proposal
    .getByLabel("I checked every claim against my original evidence.")
    .check();
  await proposal.getByRole("button", { name: "Accept coaching edit" }).click();
  await expect(coach).toContainText("Coaching edit saved");
  const saved = await (
    await page.request.get(`/api/resumes/${doc.id}`, { headers })
  ).json();
  expect(bulletEvidence(saved)[0].text).toBe(rewrite);
  expect(saved.revision).toBe(doc.revision + 1);
  expect(saved.contact).toEqual(doc.contact);
  const retry = await page.request.post(`/api/ai/${ids[0]}`, {
    headers,
    data: { decision: "accept", confirmed: true },
  });
  expect((await retry.json()).alreadyApplied).toBe(true);
  const exported = await (
    await page.request.get("/api/account/export", { headers })
  ).json();
  expect(
    exported.aiRequests.find((row: any) => row.id === ids[0]).proposal.coaching
      .promptVersion,
  ).toBe("job-criterion-coach-v1");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: false }).click();
  await expect(page.locator(".save-status")).toHaveText(
    "Saved to your account",
  );
  const restored = await (
    await page.request.get(`/api/resumes/${doc.id}`, { headers })
  ).json();
  expect(bulletEvidence(restored)[0].text).toBe(sourceText);
});

test("configured coaching with a failed independent assessment cannot offer an edit", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_OPENAI !== "1",
    "Requires isolated synthetic provider transport",
  );
  const { doc, headers } = await setup(page);
  const coach = await openCoach(page);
  await coach
    .getByLabel("Coaching instruction")
    .fill("Controlled failed assessment audit");
  await coach.getByLabel(consent).check();
  await coach
    .getByRole("button", { name: "Request criterion coaching" })
    .click();
  const proposal = coach.getByRole("article", { name: "Coaching proposal" });
  await expect(proposal).toContainText("Needs manual review");
  await expect(
    proposal.getByRole("button", { name: "Accept coaching edit" }),
  ).toHaveCount(0);
  expect(
    await (
      await page.request.get(`/api/resumes/${doc.id}`, { headers })
    ).json(),
  ).toEqual(doc);
  await proposal
    .getByRole("button", { name: "Dismiss coaching questions" })
    .click();
});
test("controlled criterion coaching requires consent and factual confirmation, rejects, saves once through real decisions and supports Undo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 850 });
  const { owner, doc, headers } = await setup(page);
  const replies = await controlledReplies(page, owner.id);
  const coach = await openCoach(page);
  const generate = coach.getByRole("button", {
    name: "Request criterion coaching",
  });
  await expect(generate).toBeDisabled();
  expect(replies.calls()).toBe(0);
  await coach.getByLabel(consent).check();
  await generate.click();
  const proposal = coach.getByRole("article", { name: "Coaching proposal" });
  await expect(proposal).toContainText(sourceText);
  await expect(proposal).toContainText(rewrite);
  await expect(
    proposal.getByRole("button", { name: "Accept coaching edit" }),
  ).toBeDisabled();
  await proposal.getByRole("button", { name: "Reject coaching" }).click();
  expect(
    await (
      await page.request.get(`/api/resumes/${doc.id}`, { headers })
    ).json(),
  ).toEqual(doc);
  await generate.click();
  await proposal
    .getByLabel("I checked every claim against my original evidence.")
    .check();
  await mkdir("test-results/job-coaching", { recursive: true });
  await proposal.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/job-coaching/mobile-controlled-review.png",
    fullPage: true,
  });
  const overflow = await page
    .getByRole("dialog")
    .evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await proposal.getByRole("button", { name: "Accept coaching edit" }).click();
  await expect(coach).toContainText("Coaching edit saved");
  const saved = await (
    await page.request.get(`/api/resumes/${doc.id}`, { headers })
  ).json();
  expect(saved.revision).toBe(1);
  expect(bulletEvidence(saved)[0].text).toBe(rewrite);
  expect(saved.contact).toEqual(doc.contact);
  expect(saved.presentation).toEqual(doc.presentation);
  const retry = await page.request.post(`/api/ai/${replies.ids[1]}`, {
    headers,
    data: { decision: "accept", confirmed: true },
  });
  expect(retry.ok()).toBe(true);
  expect((await retry.json()).alreadyApplied).toBe(true);
  const exported = await (
    await page.request.get("/api/account/export", { headers })
  ).json();
  expect(
    exported.aiRequests.find((row: any) => row.id === replies.ids[1]).proposal
      .coaching.model,
  ).toBe("controlled-test-reply");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: false }).click();
  await expect(page.locator(".save-status")).toHaveText(
    "Saved to your account",
  );
  const restored = await (
    await page.request.get(`/api/resumes/${doc.id}`, { headers })
  ).json();
  expect(bulletEvidence(restored)[0].text).toBe(sourceText);
  expect(restored.revision).toBe(2);
});
test("withheld controlled coaching supplies questions and cannot offer an applicable edit", async ({
  page,
}) => {
  const { owner, doc, headers } = await setup(page);
  await controlledReplies(page, owner.id, { withheld: true });
  const coach = await openCoach(page);
  await coach.getByLabel(consent).check();
  await coach
    .getByRole("button", { name: "Request criterion coaching" })
    .click();
  const proposal = coach.getByRole("article", { name: "Coaching proposal" });
  await expect(proposal).toContainText("Needs manual review");
  await expect(proposal).toContainText("Add confirmed facts");
  await expect(
    proposal.getByRole("button", { name: "Accept coaching edit" }),
  ).toHaveCount(0);
  await proposal
    .getByRole("button", { name: "Dismiss coaching questions" })
    .click();
  expect(
    await (
      await page.request.get(`/api/resumes/${doc.id}`, { headers })
    ).json(),
  ).toEqual(doc);
});
test("unconfirmed controlled generation retries the same record; source changes prevent real server acceptance", async ({
  page,
}) => {
  const { owner, doc, headers } = await setup(page);
  const replies = await controlledReplies(page, owner.id, {
    loseResponse: true,
  });
  const coach = await openCoach(page);
  await coach.getByLabel(consent).check();
  await coach
    .getByRole("button", { name: "Request criterion coaching" })
    .click();
  await expect(coach.getByRole("alert")).toContainText(
    "Could not reach account storage",
  );
  await coach
    .getByRole("button", { name: "Request criterion coaching" })
    .click();
  await expect(
    coach.getByRole("article", { name: "Coaching proposal" }),
  ).toBeVisible();
  expect(replies.ids).toHaveLength(2);
  expect(replies.ids[0]).toBe(replies.ids[1]);
  expect(replies.calls()).toBe(1);
  const edited = await page.request.post("/api/resumes", {
    headers,
    data: {
      document: { ...doc, name: "Later source edit" },
      expectedRevision: doc.revision,
    },
  });
  expect(edited.ok()).toBe(true);
  await coach
    .getByLabel("I checked every claim against my original evidence.")
    .check();
  await coach.getByRole("button", { name: "Accept coaching edit" }).click();
  await expect(coach.getByRole("alert")).toContainText("This resume changed");
  await expect(
    coach.getByRole("article", { name: "Coaching proposal" }),
  ).toBeVisible();
  const current = await (
    await page.request.get(`/api/resumes/${doc.id}`, { headers })
  ).json();
  expect(current.name).toBe("Later source edit");
  expect(bulletEvidence(current)[0].text).toBe(sourceText);
});
