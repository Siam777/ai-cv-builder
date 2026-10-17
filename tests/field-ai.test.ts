import test from "node:test";
import assert from "node:assert/strict";
import { createDocument } from "../src/lib/document";
import {
  diffWords,
  fieldAction,
  fieldActions,
  fixGrammar,
  skillsProposal,
} from "../src/lib/field-ai";
import { helpMeFinish } from "../src/lib/help-me-finish";
import {
  planAllows,
  rewriteStatus,
  REWRITE_STATUS_TEXT,
} from "../src/lib/ai-access";
import { synthesizeVerifiedXyzBullet } from "../src/lib/vault/impact-coach";

test("each field kind has its own sparkle actions, and only rewrites use AI", () => {
  assert.deepEqual(
    fieldActions("bullet").map((a) => a.id),
    ["improve", "shorten", "continue", "selection", "result", "grammar"],
  );
  assert.deepEqual(
    fieldActions("summary").map((a) => a.id),
    ["ai-draft", "examples", "draft", "grammar"],
  );
  assert.deepEqual(
    fieldActions("skills").map((a) => a.id),
    ["ai-skills", "examples", "skills"],
  );
  const ai = fieldActions("bullet")
    .filter((a) => a.source === "ai")
    .map((a) => a.id);
  assert.deepEqual(ai, ["improve", "shorten", "continue", "selection"]);
  assert.equal(fieldAction("ai-draft").source, "ai");
  assert.equal(fieldAction("draft").source, "local");
  // Built-in helpers are never labelled as AI.
  assert.equal(fieldAction("result").source, "local");
  assert.match(fieldAction("result").label, /you type it/);
  assert.equal(fieldAction("examples").source, "ai");
});

test("diffWords marks removed and added words and keeps the rest", () => {
  const parts = diffWords("Led the design team", "Led the design team to launch");
  assert.equal(parts.filter((p) => p.type === "del").length, 0);
  assert.equal(parts.map((p) => p.text).join(""), "Led the design team to launch");
  assert.ok(parts.some((p) => p.type === "ins" && p.text.includes("launch")));

  const replaced = diffWords("Worked on reports", "Built reports");
  assert.ok(replaced.some((p) => p.type === "del" && p.text.includes("Worked")));
  assert.ok(replaced.some((p) => p.type === "ins" && p.text.includes("Built")));
  const before = replaced
    .filter((p) => p.type !== "ins")
    .map((p) => p.text)
    .join("");
  const after = replaced
    .filter((p) => p.type !== "del")
    .map((p) => p.text)
    .join("");
  assert.equal(before, "Worked on reports");
  assert.equal(after, "Built reports");

  assert.deepEqual(diffWords("same", "same"), [{ type: "same", text: "same" }]);
  assert.deepEqual(diffWords("", ""), []);
});

test("diffWords falls back to a whole replacement for very long text", () => {
  const long = "word ".repeat(800).trim();
  const parts = diffWords(long, `${long} extra`.replace("word", "other"));
  assert.ok(parts.length <= 2);
});

test("fixGrammar fixes spacing, capitals and repeated words without adding facts", () => {
  assert.equal(
    fixGrammar("  led the the team ,and shipped   the app  "),
    "Led the team, and shipped the app",
  );
  assert.equal(fixGrammar("i built it and i tested it"), "I built it and I tested it");
  // Numbers and abbreviations are left alone.
  assert.equal(fixGrammar("Cut costs by 1,000 i.e. a lot"), "Cut costs by 1,000 i.e. a lot");
  assert.equal(fixGrammar("Already clean."), "Already clean.");
});

test("the XYZ rewrite does not repeat the verb the bullet already starts with", () => {
  const result = synthesizeVerifiedXyzBullet(
    "Led the design of a collaborative workspace.",
    "40% faster weekly reports",
  );
  assert.equal(
    result,
    "Led the design of a collaborative workspace, resulting in 40% faster weekly reports.",
  );
  assert.ok(!/Led Led/.test(result));

  // A different past-tense opener is kept rather than prefixed with a second verb.
  assert.equal(
    synthesizeVerifiedXyzBullet("Prepared weekly support reports.", "cutting prep time by 30%"),
    "Prepared weekly support reports, cutting prep time by 30%.",
  );
});

test("skillsProposal only adds skills the bullets show and are not listed yet", () => {
  const doc = createDocument(false);
  const experience = doc.sections.find((s) => s.type === "experience")!;
  experience.entries = [
    {
      id: "e1",
      title: "Engineer",
      organization: "Acme",
      location: "",
      start: "",
      end: "",
      current: false,
      description: "",
      bullets: [{ id: "b1", text: "Built services with Python and PostgreSQL." }],
    },
  ];
  const found = skillsProposal(doc, "Python");
  assert.ok(found.skills.includes("PostgreSQL"));
  assert.ok(!found.skills.includes("Python"));
  assert.ok(found.text.includes("PostgreSQL"));
  const none = skillsProposal(doc, "Python · PostgreSQL");
  assert.deepEqual(none.skills, []);
  assert.equal(none.text, "Python · PostgreSQL");
});

test("helpMeFinish lists a summary, missing results and skills, and shrinks as they are done", () => {
  const doc = createDocument(false);
  const experience = doc.sections.find((s) => s.type === "experience")!;
  experience.entries = [
    {
      id: "e1",
      title: "Engineer",
      organization: "Acme",
      location: "",
      start: "",
      end: "",
      current: false,
      description: "",
      bullets: [
        { id: "b1", text: "Maintained the Python billing service." },
        { id: "b2", text: "Cut report time by 40%." },
      ],
    },
  ];
  const summary = doc.sections.find((s) => s.type === "summary");
  if (summary) summary.entries = [];
  doc.contact.headline = "Software engineer";

  const items = helpMeFinish(doc);
  const ids = items.map((i) => i.id);
  assert.ok(ids.includes("summary"));
  assert.ok(ids.includes("result-b1"), "a bullet without a number needs a result");
  assert.ok(!ids.includes("result-b2"), "a bullet with a number is done");
  const skills = items.find((i) => i.kind === "skills");
  assert.ok(skills, "skills named in bullets but not listed");
  assert.equal(skills!.action, "skills");
  const result = items.find((i) => i.id === "result-b1")!;
  assert.equal(result.bulletId, "b1");
  assert.equal(result.entryId, "e1");
  assert.equal(result.action, "result");
  assert.ok(items.length <= 8);

  // Doing the work removes the items.
  experience.entries[0].bullets[0].text = "Maintained the Python billing service, cutting errors by 30%.";
  const sectionId = summary?.id ?? "s";
  if (summary) {
    summary.entries = [
      {
        id: "sum",
        title: "Summary",
        organization: "",
        location: "",
        start: "",
        end: "",
        current: false,
        description: "Engineer who ships billing systems.",
        bullets: [],
      },
    ];
  }
  assert.ok(sectionId);
  const after = helpMeFinish(doc).map((i) => i.id);
  assert.ok(!after.includes("result-b1"));
  if (summary) assert.ok(!after.includes("summary"));
});

test("an empty CV has nothing to draft or finish", () => {
  const doc = createDocument(false);
  for (const section of doc.sections) section.entries = [];
  doc.contact.headline = "";
  assert.deepEqual(helpMeFinish(doc), []);
});

test("tailored CV copies are locked on the free plan and open on paid plans", () => {
  assert.equal(planAllows("free", "tailored-copy"), false);
  assert.equal(planAllows("go", "tailored-copy"), true);
  assert.equal(planAllows("pro", "tailored-copy"), true);
  assert.equal(planAllows("free", "cover-letter"), false);
  assert.equal(planAllows("go", "cover-letter"), true);
  assert.equal(planAllows("go", "job-coaching"), false);
  assert.equal(planAllows("pro", "job-coaching"), true);
  assert.equal(planAllows("free", "ai-summary"), false);
  assert.equal(planAllows("go", "ai-summary"), true);
});

test("rewriteStatus explains why an AI rewrite is not available", () => {
  const live = { configured: true, signedIn: true };
  assert.equal(rewriteStatus(null, live), "account-needed");
  // Signed in, but the open CV is still the copy saved in this browser.
  assert.equal(rewriteStatus(null, null, true), "browser-cv");
  assert.equal(rewriteStatus("user-1", null), "checking");
  assert.equal(rewriteStatus("user-1", "unreachable"), "unreachable");
  assert.equal(
    rewriteStatus("user-1", { configured: false, signedIn: true }),
    "not-configured",
  );
  assert.equal(
    rewriteStatus("user-1", { configured: true, signedIn: false }),
    "session-expired",
  );
  assert.equal(rewriteStatus("user-1", live), "ready");
  for (const text of Object.values(REWRITE_STATUS_TEXT))
    assert.ok(text.length > 20);
});
