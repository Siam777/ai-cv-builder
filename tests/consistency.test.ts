import test from "node:test";
import assert from "node:assert/strict";
import {
  createDocument,
  newEntry,
  type Entry,
  type ResumeDocument,
} from "../src/lib/document";
import {
  checkConsistency,
  CONFIRMABLE_RULES,
  CONSISTENCY_RULES,
  monthRange,
  normalizeOrganization,
  normalizeTitle,
  numberClaims,
  splitSkills,
  wordOverlap,
} from "../src/lib/linter/consistency";
import {
  describeFinding,
  exportReminders,
  isConsistency,
} from "../src/lib/check-findings";
import { lintResumeDocument } from "../src/lib/linter/ats-linter";
import { DEMO_PROFILES } from "../src/lib/demo-resumes";

const TODAY = new Date("2026-11-04T12:00:00Z");

function cv(
  build: (
    add: (type: string, fields: Partial<Entry>) => Entry,
    doc: ResumeDocument,
  ) => void,
) {
  const doc = createDocument();
  let n = 0;
  const add = (type: string, fields: Partial<Entry>) => {
    const entry: Entry = { ...newEntry(), id: `e${++n}`, ...fields };
    entry.bullets = entry.bullets.map((b, i) => ({
      ...b,
      id: b.id || `${entry.id}b${i}`,
    }));
    doc.sections.find((s) => s.type === type)!.entries.push(entry);
    return entry;
  };
  build(add, doc);
  return doc;
}
const rules = (doc: ResumeDocument) =>
  checkConsistency(doc, TODAY).map((i) => i.ruleId);
const only = (doc: ResumeDocument, rule: string) =>
  checkConsistency(doc, TODAY).filter((i) => i.ruleId === rule);
const b = (text: string, id = "") => ({ id, text });

test("month ranges cover year-only and month dates", () => {
  assert.deepEqual(monthRange("2020"), [2020 * 12, 2020 * 12 + 11]);
  assert.deepEqual(monthRange("2020-03"), [2020 * 12 + 2, 2020 * 12 + 2]);
  assert.equal(monthRange(""), null);
});

test("date_order flags an end before the start, not current roles", () => {
  const bad = cv((add) =>
    add("experience", { title: "Nurse", start: "2021-05", end: "2020-01" }),
  );
  assert.equal(only(bad, "date_order").length, 1);
  const sameYear = cv((add) =>
    add("experience", { title: "Nurse", start: "2020-05", end: "2020" }),
  );
  assert.equal(only(sameYear, "date_order").length, 0);
  const current = cv((add) =>
    add("experience", {
      title: "Nurse",
      start: "2021-05",
      end: "2020-01",
      current: true,
    }),
  );
  assert.equal(only(current, "date_order").length, 0);
  const education = cv((add) =>
    add("education", { title: "BSc", start: "2019", end: "2015" }),
  );
  assert.equal(
    only(education, "date_order").length,
    1,
    "applies to any section with dates",
  );
});

test("date_future flags future experience end dates only", () => {
  const future = cv((add) =>
    add("experience", { title: "Analyst", start: "2024-01", end: "2027-06" }),
  );
  assert.equal(only(future, "date_future").length, 1);
  const thisYear = cv((add) =>
    add("experience", { title: "Analyst", start: "2024-01", end: "2026" }),
  );
  assert.equal(only(thisYear, "date_future").length, 0);
  const study = cv((add) =>
    add("education", { title: "MSc", start: "2025", end: "2027" }),
  );
  assert.equal(
    only(study, "date_future").length,
    0,
    "expected graduation is normal",
  );
});

test("date_missing needs a titled experience entry without a start", () => {
  const missing = cv((add) =>
    add("experience", { title: "Chef", organization: "Bistro" }),
  );
  assert.equal(only(missing, "date_missing").length, 1);
  const blank = cv((add) => add("experience", {}));
  assert.equal(only(blank, "date_missing").length, 0);
  const project = cv((add) => add("projects", { title: "Side app" }));
  assert.equal(only(project, "date_missing").length, 0);
});

test("date_overlap ignores short, year-boundary and part-time overlaps", () => {
  const overlap = cv((add) => {
    add("experience", {
      title: "Engineer",
      organization: "A",
      start: "2019-01",
      end: "2021-06",
    });
    add("experience", {
      title: "Engineer",
      organization: "B",
      start: "2021-01",
      end: "2023-01",
    });
  });
  const found = only(overlap, "date_overlap");
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].relatedEntryIds, ["e1", "e2"]);
  assert.equal(found[0].severity, "suggestion");

  const handover = cv((add) => {
    add("experience", { title: "Engineer", start: "2019-01", end: "2021-06" });
    add("experience", { title: "Engineer", start: "2021-05", end: "2023-01" });
  });
  assert.equal(
    only(handover, "date_overlap").length,
    0,
    "two months is a handover",
  );

  const years = cv((add) => {
    add("experience", { title: "Engineer", start: "2019", end: "2022" });
    add("experience", { title: "Engineer", start: "2022", current: true });
  });
  assert.equal(
    only(years, "date_overlap").length,
    0,
    "year-only dates do not invent overlaps",
  );

  const partTime = cv((add) => {
    add("experience", { title: "Engineer", start: "2019-01", current: true });
    add("experience", {
      title: "Part-time tutor",
      start: "2020-01",
      current: true,
    });
  });
  assert.equal(only(partTime, "date_overlap").length, 0);
});

test("org_spelling ignores case-only-equal suffix variants but finds spelling variants", () => {
  assert.equal(
    normalizeOrganization("Acme Ltd."),
    normalizeOrganization("ACME Limited"),
  );
  assert.equal(normalizeOrganization("The Acme Group, Inc"), "acme");
  const variants = cv((add) => {
    add("experience", {
      title: "Dev",
      organization: "Acme Ltd",
      start: "2020",
    });
    add("experience", {
      title: "Lead",
      organization: "ACME Limited",
      start: "2022",
    });
  });
  const found = only(variants, "org_spelling");
  assert.equal(found.length, 1);
  assert.match(found[0].message, /Acme Ltd.*ACME Limited/);
  const same = cv((add) => {
    add("experience", {
      title: "Dev",
      organization: "Acme Ltd",
      start: "2020",
    });
    add("experience", {
      title: "Lead",
      organization: "Acme Ltd",
      start: "2022",
    });
  });
  assert.equal(only(same, "org_spelling").length, 0);
});

test("title_variant expands common abbreviations", () => {
  assert.equal(
    normalizeTitle("Sr. Engineer"),
    normalizeTitle("Senior Engineer"),
  );
  const doc = cv((add) => {
    add("experience", {
      title: "Sr. Engineer",
      organization: "A",
      start: "2020",
    });
    add("experience", {
      title: "Senior Engineer",
      organization: "B",
      start: "2022",
    });
  });
  assert.equal(only(doc, "title_variant").length, 1);
  const different = cv((add) => {
    add("experience", { title: "Engineer", organization: "A", start: "2020" });
    add("experience", {
      title: "Senior Engineer",
      organization: "B",
      start: "2022",
    });
  });
  assert.equal(only(different, "title_variant").length, 0);
});

test("duplicate_bullet uses a high word-overlap threshold", () => {
  assert.equal(wordOverlap("Led the team", "led the team!"), 1);
  const doc = cv((add) => {
    add("experience", {
      title: "A",
      start: "2020",
      bullets: [b("Built the onboarding flow for new customers in Europe")],
    });
    add("experience", {
      title: "B",
      start: "2022",
      bullets: [b("Built the onboarding flow for new customers in Europe.")],
    });
  });
  const found = only(doc, "duplicate_bullet");
  assert.equal(found.length, 1);
  assert.equal(found[0].bulletId, "e2b0");
  const near = cv((add) => {
    add("experience", {
      title: "A",
      start: "2020",
      bullets: [b("Built the onboarding flow for new customers in Europe")],
    });
    add("experience", {
      title: "B",
      start: "2022",
      bullets: [b("Built the billing flow for new partners in Asia")],
    });
  });
  assert.equal(only(near, "duplicate_bullet").length, 0);
});

test("repeated_number needs the same claim in two different entries", () => {
  const doc = cv((add) => {
    add("experience", {
      title: "A",
      start: "2020",
      bullets: [b("Cut costs by 30% through vendor review")],
    });
    add("experience", {
      title: "B",
      start: "2022",
      bullets: [b("Cut hosting costs 30% with caching")],
    });
  });
  assert.equal(only(doc, "repeated_number").length, 1);
  const sameEntry = cv((add) => {
    add("experience", {
      title: "A",
      start: "2020",
      bullets: [
        b("Raised NPS 30% in a year"),
        b("Grew retention 30% after launch"),
      ],
    });
  });
  assert.equal(only(sameEntry, "repeated_number").length, 0);
});

test("years_claim compares the summary and headline with experience dates", () => {
  const over = cv((add, doc) => {
    doc.contact.headline = "Engineer with 10+ years of experience";
    add("experience", { title: "Engineer", start: "2020-01", current: true });
  });
  const found = only(over, "years_claim");
  assert.equal(found.length, 1);
  assert.equal(found[0].sectionId, "contact");
  assert.equal(found[0].field, "headline");
  assert.match(found[0].message, /about 7 years/);
  // A targeted CV may list only recent roles: a suggestion to confirm, never
  // an attention-level finding or an export reminder.
  assert.equal(found[0].severity, "suggestion");
  assert.ok(CONFIRMABLE_RULES.has("years_claim"));
  assert.deepEqual(exportReminders(found, new Set()), []);

  const fine = cv((add) => {
    add("summary", { description: "Nurse with 6 years of experience on surgical wards." });
    add("experience", { title: "Nurse", start: "2020-01", current: true });
  });
  assert.equal(only(fine, "years_claim").length, 0);

  const summary = cv((add) => {
    add("summary", { description: "Over 15 years leading teams." });
    add("experience", { title: "Lead", start: "2019", end: "2023" });
  });
  assert.equal(only(summary, "years_claim").length, 1);

  const noDates = cv((add) =>
    add("summary", { description: "20 years of experience." }),
  );
  assert.equal(only(noDates, "years_claim").length, 0);

  // Durations that are not claims about the person's experience.
  const durations = cv((add) => {
    add("summary", {
      description:
        "Shaped a 10 year growth plan, kept clients for 12 years, and planned work 5 years ahead within 2 years of launch.",
    });
    add("experience", { title: "Lead", start: "2023-01", current: true });
  });
  assert.equal(only(durations, "years_claim").length, 0);

  // "years in" a field counts; "years in a row" does not.
  const field = cv((add) => {
    add("summary", { description: "12 years in logistics. Won the award 9 years in a row." });
    add("experience", { title: "Planner", start: "2022-01", current: true });
  });
  const inField = only(field, "years_claim");
  assert.equal(inField.length, 1);
  assert.match(inField[0].message, /“12 years”/);
});

test("skill_without_evidence matches aliases and bracketed skills", () => {
  assert.deepEqual(splitSkills("AWS (EKS, RDS) · Python, Agile / Scrum"), [
    "AWS (EKS, RDS)",
    "Python",
    "Agile / Scrum",
  ]);
  const doc = cv((add) => {
    add("skills", {
      title: "Tools",
      description: "JavaScript · AWS (EKS, RDS) · Kubernetes · Scrum",
    });
    add("experience", {
      title: "Dev",
      start: "2020",
      bullets: [
        b("Rebuilt the checkout in JS and moved it to EKS"),
        b("Ran agile ceremonies with Scrum"),
      ],
    });
  });
  const found = only(doc, "skill_without_evidence");
  assert.equal(found.length, 1, "one grouped finding");
  assert.equal(found[0].message, "Kubernetes.");
  const all = cv((add) => {
    add("skills", { description: "Python" });
    add("experience", {
      title: "Dev",
      start: "2020",
      bullets: [b("Automated reports in Python")],
    });
  });
  assert.equal(only(all, "skill_without_evidence").length, 0);
});

test("number_to_confirm groups numbers per entry and keeps thousands separators", () => {
  assert.deepEqual(
    numberClaims("Grew to 320,000 monthly users and saved $2.4M").sort(),
    ["$2.4M", "320,000 monthly users"],
  );
  const doc = cv((add) => {
    add("experience", {
      title: "Lead",
      start: "2020",
      bullets: [
        b("Cut churn 12%"),
        b("Led a team of 8 engineers"),
        b("Wrote the handbook"),
      ],
    });
  });
  const found = only(doc, "number_to_confirm");
  assert.equal(found.length, 1);
  assert.equal(found[0].bulletId, "e1b0");
  assert.match(found[0].message, /12%/);
  assert.match(found[0].message, /team of 8/);
});

test("hidden sections are not checked", () => {
  const doc = cv((add) =>
    add("experience", { title: "Nurse", start: "2021-05", end: "2020-01" }),
  );
  doc.sections.find((s) => s.type === "experience")!.visible = false;
  assert.deepEqual(rules(doc), []);
});

test("IDs are stable and change when the quoted text changes", () => {
  const make = (end: string) =>
    cv((add) => {
      add("experience", { title: "A", start: "2019-01", end });
      add("experience", { title: "B", start: "2021-01", end: "2023-01" });
    });
  const first = only(make("2021-06"), "date_overlap")[0].id;
  assert.equal(only(make("2021-06"), "date_overlap")[0].id, first);
  assert.notEqual(only(make("2021-09"), "date_overlap")[0].id, first);

  const numbers = (text: string) =>
    only(
      cv((add) =>
        add("experience", { title: "A", start: "2020", bullets: [b(text)] }),
      ),
      "number_to_confirm",
    )[0].id;
  assert.equal(
    numbers("Cut churn 12% in a year"),
    numbers("Reduced churn 12% within one year"),
  );
  assert.notEqual(numbers("Cut churn 12%"), numbers("Cut churn 15%"));
});

test("every rule has copy, the consistency category and plain wording", () => {
  const doc = cv((add, d) => {
    d.contact.headline = "Engineer with 20 years of experience";
    add("experience", {
      title: "Sr. Engineer",
      organization: "Acme Ltd",
      start: "2021-05",
      end: "2020-01",
    });
    add("experience", {
      title: "Senior Engineer",
      organization: "ACME Limited",
      start: "2022-01",
      end: "2027-01",
    });
    add("experience", { title: "Chef", organization: "Bistro" });
    add("experience", {
      title: "Dev",
      organization: "X",
      start: "2022-06",
      end: "2024-01",
      bullets: [
        b("Cut costs by 30% through a careful vendor review"),
        b("Cut costs by 30% through a careful vendor review."),
      ],
    });
    add("experience", {
      title: "Ops",
      organization: "Y",
      start: "2023-01",
      end: "2024-06",
      bullets: [b("Saved 30% on cloud spend")],
    });
    add("skills", { description: "Kubernetes" });
  });
  const issues = checkConsistency(doc, TODAY);
  const seen = new Set(issues.map((i) => i.ruleId));
  for (const rule of CONSISTENCY_RULES)
    assert.ok(seen.has(rule), `fixture covers ${rule}`);
  for (const issue of issues) {
    assert.ok(isConsistency(issue));
    const copy = describeFinding(issue);
    assert.ok(copy.title.length > 0 && copy.title.length <= 40, copy.title);
    assert.doesNotMatch(
      `${copy.title} ${copy.detail}`,
      /suspicious|lie|dishonest|fake/i,
    );
  }
});

test("export reminders are open attention-level consistency findings only", () => {
  const doc = cv((add) => {
    add("experience", {
      title: "Nurse",
      start: "2021-05",
      end: "2020-01",
      bullets: [b("Cut waits 20%")],
    });
  });
  const issues = [
    ...lintResumeDocument(doc).issues,
    ...checkConsistency(doc, TODAY),
  ];
  const reminders = exportReminders(issues, new Set());
  assert.deepEqual(
    reminders.map((i) => i.ruleId),
    ["date_order"],
  );
  assert.deepEqual(exportReminders(issues, new Set([reminders[0].id])), []);
});

test("demo CVs raise no attention-level consistency findings", () => {
  for (const profile of DEMO_PROFILES) {
    const attention = checkConsistency(profile.create(), TODAY).filter(
      (i) => i.severity !== "suggestion",
    );
    assert.deepEqual(
      attention.map((i) => i.message),
      [],
      profile.id,
    );
  }
});
