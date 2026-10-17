import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument, type ResumeDocument } from "../../src/lib/document";
import { bulletEvidence } from "../../src/lib/ai-proposals";
import { editorTool, grantProAccount, openFirstCv } from "./helpers";

// These flows walk several steps against a dev server.
test.describe.configure({ timeout: 90_000 });

const origin = process.env.E2E_ORIGIN || "http://localhost:3100";
const password = "Synthetic-AI-phase-c-password-42";
const POST =
  "We are hiring a Product Designer. Required: lead discovery research with customers, build design systems and component libraries. Preferred: accessibility audits.";

/**
 * A real account (Go during the beta) with one saved CV. AI is reported as
 * ready; every AI reply below is controlled test data, not model output.
 */
async function accountWithCv(page: Page, edit?: (doc: ResumeDocument) => void) {
  const signup = await page.request.post("/api/auth", {
    headers: { origin, "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}` },
    data: { action: "signup", email: `ai-c-${randomUUID()}@example.test`, password },
  });
  expect(signup.status()).toBe(200);
  const user = (await (await page.request.get("/api/account")).json()).user;
  const headers = { origin, "X-Workspace-User": user.id };
  const fixture = createDocument(true);
  edit?.(fixture);
  const doc: ResumeDocument = await (
    await page.request.post("/api/resumes", { headers, data: { document: fixture, expectedRevision: null } })
  ).json();
  return {
    user,
    doc,
    headers,
    cleanup: () =>
      page.request.delete("/api/account", { headers, data: { password, confirmation: "DELETE MY ACCOUNT" } }),
  };
}

/** Controlled /api/ai: GET is ready; POST returns a proposal built by the test. */
async function controlledRewrites(
  page: Page,
  propose: (body: Record<string, unknown>) => Record<string, unknown>,
) {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/ai", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true, signedIn: true } });
    const body = route.request().postDataJSON();
    bodies.push(body);
    await route.fulfill({ json: propose(body) });
  });
  return bodies;
}

/** Controlled decisions: an accept saves the ticked rewrites through the real resume API. */
async function controlledDecisions(
  page: Page,
  headers: Record<string, string>,
  proposals: Map<string, { baseRevision: number; operations: { bulletId: string; text: string }[] }>,
) {
  const decisions: Record<string, unknown>[] = [];
  await page.route(/\/api\/ai\/[0-9a-f-]{36}$/, async (route) => {
    const body = route.request().postDataJSON();
    decisions.push(body);
    if (body.decision === "reject") return route.fulfill({ json: { rejected: true } });
    const id = new URL(route.request().url()).pathname.split("/").pop()!;
    const proposal = proposals.get(id)!;
    const list = await (await page.request.get("/api/resumes", { headers })).json();
    const summary = (Array.isArray(list) ? list : list.resumes ?? list.documents)[0];
    const current = await (await page.request.get(`/api/resumes/${summary.id}`, { headers })).json();
    for (const op of proposal.operations)
      if (!body.bulletIds || body.bulletIds.includes(op.bulletId))
        for (const bullet of current.sections.flatMap((s: any) => s.entries).flatMap((e: any) => e.bullets))
          if (bullet.id === op.bulletId) bullet.text = op.text;
    const saved = await page.request.post("/api/resumes", {
      headers,
      data: { document: current, expectedRevision: proposal.baseRevision },
    });
    await route.fulfill({ json: { document: await saved.json(), alreadyApplied: false } });
  });
  return decisions;
}

async function bulletTexts(page: Page, headers: Record<string, string>, id: string) {
  const doc = await (await page.request.get(`/api/resumes/${id}`, { headers })).json();
  return bulletEvidence(doc).map((b) => b.text);
}

test("Improve all bullets reviews one job's rewrites, applies only the ticked ones, and Undo restores them", async ({
  page,
}) => {
  const { doc, headers, cleanup } = await accountWithCv(page);
  const [b1, b2] = bulletEvidence(doc);
  const proposals = new Map();
  const bodies = await controlledRewrites(page, (body) => {
    const proposal = {
      schemaVersion: 1,
      id: body.requestId,
      documentId: doc.id,
      baseRevision: body.revision,
      message: "Clearer wording.",
      questions: [],
      operations: [
        { type: "replaceBullet", sectionId: b1.sectionId, entryId: b1.entryId, bulletId: b1.id, before: b1.text, text: "Led workspace design from discovery to launch.", evidenceIds: [b1.id] },
        { type: "replaceBullet", sectionId: b2.sectionId, entryId: b2.entryId, bulletId: b2.id, before: b2.text, text: "Built a shared component library with engineering.", evidenceIds: [b2.id] },
      ],
    };
    proposals.set(body.requestId, proposal);
    return proposal;
  });
  const decisions = await controlledDecisions(page, headers, proposals);
  try {
    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await page.locator(".section-nav").getByRole("button", { name: /^Experience/ }).click();
    await page.getByRole("button", { name: "Improve all bullets: Senior Product Designer at Northstar Studio" }).click();
    const card = page.getByRole("group", { name: "Improve all bullets: Senior Product Designer at Northstar Studio" });
    await card.getByRole("button", { name: "Turn on AI writing help" }).click();
    await expect(card).toContainText("Tick the rewrites to keep.");
    expect(bodies[0]).toMatchObject({ mode: "entry", bulletId: b1.id, consent: true });
    const accept = card.getByRole("button", { name: "Accept ticked" });
    await card.getByLabel("Keep rewrite 2").check();
    await expect(accept).toBeDisabled();
    await card.getByLabel("I checked the ticked rewrites and they accurately describe my experience.").check();
    await accept.click();
    await expect(card).toContainText("Applied 1 rewrite.");
    expect(decisions[0]).toMatchObject({ decision: "accept", bulletIds: [b2.id] });
    const after = await bulletTexts(page, headers, doc.id);
    expect(after).toContain("Built a shared component library with engineering.");
    expect(after).toContain(b1.text);
    await page.getByRole("button", { name: "Undo", exact: false }).click();
    await expect(page.locator(".save-status")).toHaveText("Saved to your account");
    await expect.poll(() => bulletTexts(page, headers, doc.id)).toContain(b2.text);
  } finally {
    await cleanup();
  }
});

test("Check my CV's Fix with AI opens Improve wording on the finding's bullet; Continue writing and Rewrite selection send their mode", async ({
  page,
}) => {
  const weak = "Worked on the onboarding research with the product team.";
  const { doc, cleanup } = await accountWithCv(page, (fixture) => {
    fixture.sections.find((s) => s.type === "experience")!.entries[0].bullets[2].text = weak;
  });
  const target = bulletEvidence(doc).find((b) => b.text === weak)!;
  const bodies = await controlledRewrites(page, (body) => ({
    schemaVersion: 1,
    id: body.requestId,
    documentId: doc.id,
    baseRevision: body.revision,
    message: `Controlled ${body.mode ?? "rewrite"} suggestion`,
    questions: [],
    operations: [
      {
        type: "replaceBullet",
        sectionId: target.sectionId,
        entryId: target.entryId,
        bulletId: target.id,
        before: weak,
        text:
          body.mode === "continue"
            ? `${weak} and shared the findings.`
            : body.mode === "selection"
              ? weak.replace("onboarding research", "onboarding studies")
              : "Researched onboarding with the product team.",
        evidenceIds: [target.id],
      },
    ],
  }));
  try {
    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await editorTool(page, "Check");
    await page.getByRole("button", { name: "Fix with AI: Start with a stronger verb" }).first().click();
    const field = page.locator(`[data-bullet-id="${target.id}"]`);
    const card = field.getByRole("group", { name: /^AI help for Bullet/ });
    await card.getByRole("button", { name: "Turn on AI writing help" }).click();
    await expect(card).toContainText("Controlled rewrite suggestion");
    expect(bodies[0]).toMatchObject({ bulletId: target.id, consent: true });
    expect(bodies[0].mode).toBeUndefined();
    await card.getByRole("button", { name: "Keep mine" }).click();

    // Continue writing.
    await field.getByRole("button", { name: /^AI help for Bullet/ }).click();
    await page.getByRole("menuitem", { name: /^Continue writing/ }).click();
    await expect(card).toContainText("Controlled continue suggestion");
    expect(bodies[1]).toMatchObject({ mode: "continue", bulletId: target.id });
    await card.getByRole("button", { name: "Keep mine" }).click();

    // Rewrite selection: the selected characters are sent; nothing else may change.
    const textbox = field.getByRole("textbox").first();
    const start = weak.indexOf("onboarding research");
    await textbox.evaluate(
      (el, [s, e]) => (el as HTMLTextAreaElement).setSelectionRange(s, e),
      [start, start + "onboarding research".length],
    );
    await field.getByRole("button", { name: /^AI help for Bullet/ }).click();
    await page.getByRole("menuitem", { name: /^Rewrite selection/ }).click();
    await expect(card).toContainText("Controlled selection suggestion");
    expect(bodies[2]).toMatchObject({
      mode: "selection",
      selection: { start, end: start + "onboarding research".length },
    });
  } finally {
    await cleanup();
  }
});

test("Match with AI shows quoted evidence and gaps, fills a gap only from the person's line, and Tailor with AI saves a separate copy", async ({
  page,
}) => {
  const { user, doc, headers, cleanup } = await accountWithCv(page);
  await grantProAccount(user.id);
  const [b1, b2] = bulletEvidence(doc);
  await page.route("**/api/ai", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true, signedIn: true } })
      : route.fallback(),
  );
  const sent: Record<string, Record<string, unknown>> = {};
  await page.route("**/api/ai/job-match", async (route) => {
    const body = route.request().postDataJSON();
    sent.match = body;
    await route.fulfill({
      json: {
        requestId: body.requestId,
        withheld: 1,
        requirements: [
          { id: "requirement-1", text: "Build design systems and component libraries", priority: "required", status: "shown", evidence: [{ id: b2.id, text: b2.text }] },
          { id: "requirement-2", text: "Accessibility audits", priority: "preferred", status: "gap", evidence: [] },
          { id: "requirement-3", text: "Lead discovery research with customers", priority: "required", status: "gap", evidence: [] },
        ],
      },
    });
  });
  await page.route("**/api/ai/gap-line", async (route) => {
    const body = route.request().postDataJSON();
    sent.gap = body;
    await route.fulfill({
      json: {
        requestId: body.requestId,
        placement: "entry",
        sectionId: b1.sectionId,
        entryId: b1.entryId,
        entryLabel: "Senior Product Designer at Northstar Studio",
        text: "Ran accessibility audits on the checkout flow.",
        message: "",
      },
    });
  });
  await page.route("**/api/ai/tailor", async (route) => {
    const body = route.request().postDataJSON();
    sent.tailor = body;
    await route.fulfill({
      json: {
        requestId: body.requestId,
        summary: { before: "", text: "Product designer who builds design systems with engineering." },
        rewrites: [
          { bulletId: b2.id, sectionId: b2.sectionId, entryId: b2.entryId, entryLabel: "Senior Product Designer at Northstar Studio", before: b2.text, text: "Built a shared design system and component library with engineering." },
        ],
        withheld: 0,
      },
    });
  });
  try {
    await page.goto("/builder");
    await openFirstCv(page, "Practice copies");
    await editorTool(page, "Match a job");
    const panel = page.getByRole("complementary", { name: "AI Assistant" });
    await panel.getByLabel("Target Job Title").fill("Product Designer");
    await panel.getByLabel("Company Name").fill("Contoso");
    await panel.getByLabel("Job Description").fill(POST);
    const section = panel.locator(".ai-job-match");
    await section.getByRole("button", { name: "Match with AI" }).click();
    await section.getByRole("button", { name: "Turn on AI writing help" }).click();
    await expect(section).toContainText("Your CV shows (1)");
    await expect(section).toContainText(`From your CV: “${b2.text}”`);
    await expect(section).toContainText("Gaps (2)");
    expect(sent.match).toMatchObject({ job: { title: "Product Designer", company: "Contoso", post: POST } });
    expect(JSON.stringify(sent.match)).not.toContain("alex@example.com");

    // No: the gap stays, nothing is added.
    await section.getByRole("button", { name: "No, I do not have: Lead discovery research with customers" }).click();
    await expect(section).toContainText("You said you do not have this. Nothing was added.");
    // Yes: the person's line becomes a bullet they review.
    await section.getByRole("button", { name: "Yes, I have: Accessibility audits" }).click();
    await section
      .getByLabel("In one line, what did you do? Name the job or project.")
      .fill("I ran accessibility audits on the checkout flow at Northstar");
    await section.getByRole("button", { name: "Suggest where it goes" }).click();
    await expect(section).toContainText("Add to Senior Product Designer at Northstar Studio");
    expect(sent.gap).toMatchObject({ requirement: "Accessibility audits" });
    await section.getByRole("button", { name: "Add it" }).click();
    await expect(section).toContainText("Added from your own words.");
    await expect(page.locator(".save-status")).toHaveText("Saved to your account");
    await expect.poll(() => bulletTexts(page, headers, doc.id)).toContain("Ran accessibility audits on the checkout flow.");

    // Tailor with AI (Pro): a separate copy; the original keeps its wording.
    await section.getByRole("button", { name: "Tailor with AI" }).click();
    expect(sent.tailor).toMatchObject({ requirements: ["Build design systems and component libraries"] });
    const save = section.getByRole("button", { name: "Save as tailored copy" });
    await section.getByLabel("Use tailored bullet 1 (Senior Product Designer at Northstar Studio)").check();
    await expect(save).toBeDisabled();
    await section.getByLabel("I checked the ticked wording and it accurately describes my experience.").check();
    await save.click();
    await expect.poll(async () => {
      const list = await (await page.request.get("/api/resumes", { headers })).json();
      return (Array.isArray(list) ? list : list.resumes ?? list.documents).map((d: { name: string }) => d.name);
    }).toContainEqual(expect.stringContaining("(Tailored with AI)"));
    expect(await bulletTexts(page, headers, doc.id)).toContain(b2.text);
  } finally {
    await cleanup();
  }
});
