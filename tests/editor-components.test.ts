import test from "node:test";
import assert from "node:assert/strict";
import {
  createDocument,
  type ResumeDocument,
  type Entry,
  type Bullet,
  uid,
} from "../src/lib/document";
import { layoutBlocks, type LayoutBlock } from "../src/lib/layout";

test("layout blocks generate valid data-block-id attributes for preview-to-editor sync", () => {
  const doc = createDocument(true);
  const blocks = layoutBlocks(doc);

  // Check that header contact blocks have standard identifiers
  const nameBlock = blocks.find((b) => b.kind === "name");
  assert.ok(nameBlock, "name block should exist");
  assert.equal(nameBlock.id, "name");

  // Check that experience section has section block and bullet blocks with matching IDs
  const expSection = doc.sections.find((s) => s.type === "experience")!;
  const expSectionBlock = blocks.find((b) => b.id === expSection.id);
  assert.ok(expSectionBlock, "section block should exist with section id");

  // Check bullet blocks
  const firstEntry = expSection.entries[0];
  assert.ok(firstEntry.bullets.length > 0, "sample experience should have bullets");
  for (const bullet of firstEntry.bullets) {
    const bulletBlock = blocks.find((b) => b.id === bullet.id);
    assert.ok(bulletBlock, `block should exist for bullet id ${bullet.id}`);
    assert.equal(bulletBlock.kind, "bullet");
    assert.equal(bulletBlock.text, bullet.text);
  }
});

test("bidirectional block click mapping correctly resolves sections, entries, and bullets", () => {
  const doc = createDocument(true);
  const blocks = layoutBlocks(doc);

  function resolveTarget(block: LayoutBlock) {
    if (
      ["name", "headline", "location", "email", "phone", "website"].includes(block.id) ||
      block.kind === "name" ||
      block.kind === "headline" ||
      block.kind === "contact"
    ) {
      return { sectionId: "contact", field: block.id };
    }

    for (const s of doc.sections) {
      if (s.id === block.id) {
        return { sectionId: s.id };
      }
      for (const e of s.entries) {
        for (const b of e.bullets) {
          if (b.id === block.id) {
            return { sectionId: s.id, entryId: e.id, bulletId: b.id };
          }
        }
        if (
          e.id === block.group ||
          `${e.id}-title` === block.id ||
          `${e.id}-meta` === block.id ||
          `${e.id}-description` === block.id
        ) {
          return { sectionId: s.id, entryId: e.id };
        }
      }
    }

    return null;
  }

  // Test name block resolves to contact
  const nameTarget = resolveTarget(blocks.find((b) => b.kind === "name")!);
  assert.deepEqual(nameTarget, { sectionId: "contact", field: "name" });

  // Test experience bullet resolves to exact section, entry, and bullet
  const bulletBlock = blocks.find((b) => b.kind === "bullet")!;
  const bulletTarget = resolveTarget(bulletBlock);
  assert.ok(bulletTarget);
  assert.equal(bulletTarget.bulletId, bulletBlock.id);
  assert.ok(bulletTarget.entryId);
  assert.ok(bulletTarget.sectionId);
});

test("bullet list operations preserve stable identifiers and immutability invariants", () => {
  const bullets: Bullet[] = [
    { id: "b1", text: "Led frontend development of core app" },
    { id: "b2", text: "Optimized build performance" },
  ];

  // Insert below index 0
  const newBullet: Bullet = { id: uid(), text: "" };
  const afterInsert = [...bullets];
  afterInsert.splice(1, 0, newBullet);

  assert.equal(afterInsert.length, 3);
  assert.equal(afterInsert[0].id, "b1");
  assert.equal(afterInsert[1].id, newBullet.id);
  assert.equal(afterInsert[2].id, "b2");

  // Reorder index 1 with delta +1
  const afterMove = [...afterInsert];
  const [moved] = afterMove.splice(1, 1);
  afterMove.splice(2, 0, moved);

  assert.equal(afterMove[0].id, "b1");
  assert.equal(afterMove[1].id, "b2");
  assert.equal(afterMove[2].id, newBullet.id);

  // Remove empty bullet
  const afterRemove = afterMove.filter((b) => b.id !== newBullet.id);
  assert.equal(afterRemove.length, 2);
  assert.equal(afterRemove[0].id, "b1");
  assert.equal(afterRemove[1].id, "b2");
});

test("skills taxonomy tags manipulate entry description correctly without duplicating", () => {
  const { parseSkillsFromText, addSkillToText, removeSkillFromText } = require("../src/lib/skills-taxonomy");
  const doc = createDocument(true);
  const skillsSection = doc.sections.find((s) => s.type === "skills")!;
  assert.ok(skillsSection);
  const firstEntry = skillsSection.entries[0];
  assert.ok(firstEntry);

  const initialSkills = parseSkillsFromText(firstEntry.description);
  assert.ok(initialSkills.length > 0);

  // Add a new skill
  const withDocker = addSkillToText(firstEntry.description, "Docker");
  assert.ok(parseSkillsFromText(withDocker).includes("Docker"));

  // Duplicate add is idempotent
  const withDockerAgain = addSkillToText(withDocker, "docker");
  assert.equal(withDockerAgain, withDocker);

  // Remove skill
  const withoutDocker = removeSkillFromText(withDocker, "Docker");
  assert.ok(!parseSkillsFromText(withoutDocker).includes("Docker"));
});
