import test from "node:test";
import assert from "node:assert/strict";
import {
  searchSkillsTaxonomy,
  resolveCanonicalSkill,
  parseSkillsFromText,
  addSkillToText,
  removeSkillFromText,
  formatSkillsList,
  getSkillsByCategory,
  getTaxonomyCategories,
} from "../src/lib/skills-taxonomy";

test("searchSkillsTaxonomy finds skills by exact name, prefix, and alias", () => {
  // Exact name
  const reactMatches = searchSkillsTaxonomy("React");
  assert.ok(reactMatches.length > 0);
  assert.equal(reactMatches[0].name, "React");

  // Prefix match
  const typeMatches = searchSkillsTaxonomy("Type");
  assert.ok(typeMatches.some((s) => s.name === "TypeScript"));

  // Common alias matches
  const k8sMatches = searchSkillsTaxonomy("k8s");
  assert.ok(k8sMatches.some((s) => s.name === "Kubernetes"));

  const tsMatches = searchSkillsTaxonomy("ts");
  assert.ok(tsMatches.some((s) => s.name === "TypeScript"));

  const pyMatches = searchSkillsTaxonomy("py");
  assert.ok(pyMatches.some((s) => s.name === "Python"));

  const postgresMatches = searchSkillsTaxonomy("postgres");
  assert.ok(postgresMatches.some((s) => s.name === "PostgreSQL"));

  const awsMatches = searchSkillsTaxonomy("aws");
  assert.ok(awsMatches.some((s) => s.name === "AWS"));
});

test("searchSkillsTaxonomy filters by category and respects limits", () => {
  const frontendSkills = searchSkillsTaxonomy("", { category: "frontend", limit: 5 });
  assert.equal(frontendSkills.length, 5);
  for (const s of frontendSkills) {
    assert.equal(s.category, "frontend");
  }

  const cloudMatches = searchSkillsTaxonomy("docker", { category: "cloud_devops" });
  assert.ok(cloudMatches.some((s) => s.name === "Docker"));

  // Querying something in another category returns empty if restricted
  const mismatch = searchSkillsTaxonomy("Figma", { category: "database", strictCategory: true });
  assert.equal(mismatch.length, 0);
});

test("resolveCanonicalSkill accurately maps variants and aliases to canonical taxonomy", () => {
  assert.equal(resolveCanonicalSkill("k8s")?.name, "Kubernetes");
  assert.equal(resolveCanonicalSkill("K8S")?.name, "Kubernetes");
  assert.equal(resolveCanonicalSkill("Postgres")?.name, "PostgreSQL");
  assert.equal(resolveCanonicalSkill("React.js")?.name, "React");
  assert.equal(resolveCanonicalSkill("reactjs")?.name, "React");
  assert.equal(resolveCanonicalSkill("TS")?.name, "TypeScript");
  assert.equal(resolveCanonicalSkill("golang")?.name, "Go");
  assert.equal(resolveCanonicalSkill("Amazon Web Services")?.name, "AWS");
  assert.equal(resolveCanonicalSkill("ci/cd")?.name, "CI/CD");
  assert.equal(resolveCanonicalSkill("UnknownSkillXYZ"), null);
});

test("parseSkillsFromText extracts skills from dots, commas, bullets, and pipes", () => {
  const dotSeparated = "React · TypeScript · Next.js · Tailwind CSS";
  assert.deepEqual(parseSkillsFromText(dotSeparated), [
    "React",
    "TypeScript",
    "Next.js",
    "Tailwind CSS",
  ]);

  const commaSeparated = "Python, Django, PostgreSQL, Docker, AWS";
  assert.deepEqual(parseSkillsFromText(commaSeparated), [
    "Python",
    "Django",
    "PostgreSQL",
    "Docker",
    "AWS",
  ]);

  const bulletSeparated = "• Figma\n• UI/UX Design\n• User Research";
  assert.deepEqual(parseSkillsFromText(bulletSeparated), [
    "Figma",
    "UI/UX Design",
    "User Research",
  ]);

  const pipeSeparated = "Kubernetes | Terraform | Linux | Helm";
  assert.deepEqual(parseSkillsFromText(pipeSeparated), [
    "Kubernetes",
    "Terraform",
    "Linux",
    "Helm",
  ]);

  // Deduplication check
  const duplicateList = "React · Node.js · react · REDUX";
  assert.deepEqual(parseSkillsFromText(duplicateList), [
    "React",
    "Node.js",
    "REDUX",
  ]);
});

test("addSkillToText safely appends skills without duplicates and preserves formatting", () => {
  const base = "React · TypeScript";
  const updated = addSkillToText(base, "Next.js");
  assert.equal(updated, "React · TypeScript · Next.js");

  // Attempting to add an existing skill is a no-op
  const duplicateAttempt = addSkillToText(updated, "typescript");
  assert.equal(duplicateAttempt, updated);

  // Works with empty initial text
  const fromEmpty = addSkillToText("", "PostgreSQL");
  assert.equal(fromEmpty, "PostgreSQL");

  // Preserves comma style if existing
  const commaBase = "Python, FastAPI";
  const commaUpdated = addSkillToText(commaBase, "Docker");
  assert.equal(commaUpdated, "Python, FastAPI, Docker");
});

test("removeSkillFromText safely removes skills and cleans separators", () => {
  const base = "React · TypeScript · Next.js";
  const updated = removeSkillFromText(base, "TypeScript");
  assert.equal(updated, "React · Next.js");

  // Removing non-existent skill does nothing
  assert.equal(removeSkillFromText(base, "Go"), base);

  // Removing last skill leaves empty string
  assert.equal(removeSkillFromText("Figma", "figma"), "");
});

test("getTaxonomyCategories and formatSkillsList provide expected catalog", () => {
  const categories = getTaxonomyCategories();
  assert.ok(categories.length >= 8);
  assert.ok(categories.some((c) => c.id === "frontend"));
  assert.ok(categories.some((c) => c.id === "backend"));
  assert.ok(categories.some((c) => c.id === "cloud_devops"));

  const formatted = formatSkillsList(["Go", "Rust", "Python"]);
  assert.equal(formatted, "Go · Rust · Python");
});
