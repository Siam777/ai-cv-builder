import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  copyFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createDocument } from "../src/lib/document";
import {
  APPLICATION_LIMITS,
  contactSchema,
  createApplicationSchema,
  freezeDocumentSchema,
  requirementsSchema,
  storedEventSchema,
  submissionSchema,
  updateApplicationSchema,
  dueState,
  noReplyYet,
} from "../src/lib/applications";

const uuid = () => crypto.randomUUID();
const base = { company: "Synthetic Labs", role: "Product Designer" };
const code = (expected: string) => (error: unknown) => {
  assert.equal(
    (error as { code?: string }).code,
    expected,
    (error as Error).message,
  );
  return true;
};
const status = (expected: number) => (error: unknown) => {
  assert.equal(
    (error as { status?: number }).status,
    expected,
    (error as Error).message,
  );
  return true;
};

test("schemas enforce the tracker limits", () => {
  const ok = (value: unknown) =>
    createApplicationSchema.safeParse(value).success;
  assert.equal(ok({ requestId: uuid(), ...base }), true);
  assert.equal(
    createApplicationSchema.parse({ requestId: uuid(), ...base }).stage,
    "saved",
  );
  assert.equal(
    ok({ requestId: uuid(), ...base, company: "x".repeat(201) }),
    false,
  );
  assert.equal(
    ok({ requestId: uuid(), ...base, role: "x".repeat(201) }),
    false,
  );
  assert.equal(ok({ requestId: uuid(), ...base, company: " " }), false);
  assert.equal(
    ok({ requestId: uuid(), ...base, notes: "x".repeat(5000) }),
    true,
  );
  assert.equal(
    ok({ requestId: uuid(), ...base, notes: "x".repeat(5001) }),
    false,
  );
  assert.equal(
    ok({ requestId: uuid(), ...base, jobPost: "x".repeat(30001) }),
    false,
  );
  // 30,000 four-byte characters are within the character limit (and the 192 KiB body cap).
  const multibyte = "𝒳".repeat(30000);
  assert.equal(multibyte.length, 60000); // UTF-16 surrogate pairs; the schema counts code units.
  assert.equal(
    ok({ requestId: uuid(), ...base, jobPost: "語".repeat(30000) }),
    true,
  );
  assert.ok(
    Buffer.byteLength(JSON.stringify({ jobPost: "語".repeat(30000) })) < 196608,
  );
  assert.equal(ok({ requestId: uuid(), ...base, stage: "ghosted" }), false);
  assert.equal(ok({ requestId: "not-a-uuid", ...base }), false);
  assert.equal(
    ok({ requestId: uuid(), ...base, jobUrl: "javascript:alert(1)" }),
    false,
  );
  assert.equal(
    ok({ requestId: uuid(), ...base, nextActionAt: "tomorrow" }),
    false,
  );
  assert.equal(ok({ requestId: uuid(), ...base, extra: true }), false);
  const contact = { id: "c1", name: "Sam Recruiter" };
  assert.equal(contactSchema.safeParse(contact).success, true);
  assert.equal(
    contactSchema.safeParse({ ...contact, notes: "x".repeat(1001) }).success,
    false,
  );
  assert.equal(
    contactSchema.safeParse({ ...contact, email: "not an email" }).success,
    false,
  );
  assert.equal(
    ok({
      requestId: uuid(),
      ...base,
      contacts: Array.from({ length: 11 }, (_, i) => ({
        id: `c${i}`,
        name: "N",
      })),
    }),
    false,
  );
  assert.equal(
    updateApplicationSchema.safeParse({ stage: "applied" }).success,
    false,
  ); // updatedAt is required
  assert.equal(
    requirementsSchema.safeParse(
      Array.from({ length: 41 }, (_, i) => ({
        id: `r${i}`,
        text: "x",
        kind: "must",
        quote: "x",
      })),
    ).success,
    false,
  );
  // Freezing always carries a requestId.
  assert.equal(
    freezeDocumentSchema.safeParse({ source: "snapshot", snapshotId: "s" })
      .success,
    false,
  );
  assert.equal(
    freezeDocumentSchema.safeParse({
      requestId: uuid(),
      source: "letter",
      text: "x".repeat(20001),
      name: "L",
    }).success,
    false,
  );
  assert.equal(
    submissionSchema.safeParse({
      requestId: uuid(),
      sentAt: new Date().toISOString(),
    }).success,
    false,
  );
  // A sent event without a submission is rejected by the schema (review finding 10).
  const event = {
    id: "e",
    at: new Date().toISOString(),
    fromStage: null,
    toStage: null,
  };
  assert.equal(
    storedEventSchema.safeParse({ ...event, kind: "sent", submissionId: null })
      .success,
    false,
  );
  assert.equal(
    storedEventSchema.safeParse({ ...event, kind: "sent", submissionId: "s1" })
      .success,
    true,
  );
  assert.equal(
    storedEventSchema.safeParse({ ...event, kind: "stage", submissionId: "s1" })
      .success,
    false,
  );
  assert.equal(dueState("2026-11-02", "2026-11-03"), "overdue");
  assert.equal(dueState("2026-11-03", "2026-11-03"), "due");
  assert.equal(dueState("2026-11-04", "2026-11-03"), null);
  const day = 86_400_000;
  assert.equal(
    noReplyYet({
      stage: "applied",
      stageChangedAt: new Date(Date.now() - 22 * day).toISOString(),
    }),
    true,
  );
  assert.equal(
    noReplyYet({
      stage: "applied",
      stageChangedAt: new Date(Date.now() - 2 * day).toISOString(),
    }),
    false,
  );
  assert.equal(
    noReplyYet({
      stage: "interview",
      stageChangedAt: new Date(Date.now() - 40 * day).toISOString(),
    }),
    false,
  );
});

test("tracker transactions: idempotency, ownership, events, frozen copies, receipts, submissions, export and cascade", async () => {
  process.env.TURSO_DATABASE_URL = "file::memory:";
  const { database } = await import("../src/lib/server/database");
  const { saveResume } = await import("../src/lib/server/resumes");
  const { getLogBuffer, clearLogBuffer } =
    await import("../src/lib/server/logger");
  const tracker = await import("../src/lib/server/applications");
  const { client } = database();
  try {
    await client.execute("PRAGMA foreign_keys=ON");
    for (const name of (await readdir("migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await client.executeMultiple(
        await readFile(`migrations/${name}`, "utf8"),
      );
    for (const owner of ["first", "second", "bulk"])
      await client.execute({
        sql: "INSERT INTO user VALUES (?,?,?,1,NULL,0,0)",
        args: [owner, owner, `${owner}@example.test`],
      });
    clearLogBuffer();

    // Idempotent create: same requestId and body returns the original; a changed body is 409.
    const createInput = {
      requestId: uuid(),
      ...base,
      notes: "Private note about the hiring manager",
      contacts: [{ id: "c1", name: "Sam Contact", email: "sam@example.test" }],
    };
    const app = await tracker.createApplication("first", createInput);
    assert.equal(app.stage, "saved");
    assert.equal(app.events.length, 1);
    assert.equal(app.events[0].kind, "created");
    assert.equal(app.contacts[0].role, "");
    assert.deepEqual(
      await tracker.createApplication("first", createInput),
      app,
    );
    await assert.rejects(
      tracker.createApplication("first", { ...createInput, role: "Other" }),
      code("APPLICATION_CHANGED"),
    );
    assert.equal((await tracker.listApplications("first")).length, 1);

    // Owner isolation: another account gets 404 for the application and its documents.
    for (const operation of [
      () => tracker.getApplication("second", app.id),
      () =>
        tracker.updateApplication("second", app.id, {
          updatedAt: app.updatedAt,
          stage: "applied",
        }),
      () =>
        tracker.freezeDocument("second", app.id, {
          requestId: uuid(),
          source: "letter",
          text: "Hi",
          name: "L",
        }),
      () =>
        tracker.createSubmission("second", app.id, {
          requestId: uuid(),
          sentAt: new Date().toISOString(),
          cvDocumentId: "x",
        }),
    ])
      await assert.rejects(operation, code("APPLICATION_NOT_FOUND"));
    await tracker.deleteApplication("second", app.id);
    assert.equal((await tracker.listApplications("first")).length, 1);
    assert.equal((await tracker.listApplications("second")).length, 0);

    // A stage change writes an event in the same transaction; a stale updatedAt is 409.
    const moved = await tracker.updateApplication("first", app.id, {
      updatedAt: app.updatedAt,
      stage: "applied",
      appliedAt: "2026-11-03",
      nextActionAt: "2026-11-03",
      nextAction: "Follow up",
    });
    assert.equal(moved.stage, "applied");
    assert.deepEqual(
      moved.events.map((e) => [e.kind, e.fromStage, e.toStage]),
      [
        ["created", null, "saved"],
        ["stage", "saved", "applied"],
      ],
    );
    assert.notEqual(moved.updatedAt, app.updatedAt);
    await assert.rejects(
      tracker.updateApplication("first", app.id, {
        updatedAt: app.updatedAt,
        notes: "Second tab",
      }),
      code("APPLICATION_CHANGED"),
    );
    const noted = await tracker.updateApplication("first", app.id, {
      updatedAt: moved.updatedAt,
      notes: "Updated",
    });
    assert.equal(noted.events.length, 2); // No stage change, no event.
    assert.equal(
      (await tracker.listApplications("first", { dueBy: "2026-11-03" })).length,
      1,
    );
    assert.equal(
      (await tracker.listApplications("first", { dueBy: "2026-11-02" })).length,
      0,
    );
    assert.equal(
      (await tracker.listApplications("first", { stage: "offer" })).length,
      0,
    );

    // Freezing a CV of another owner fails; a revision mismatch fails.
    const theirs = await saveResume("second", createDocument(true), null);
    await assert.rejects(
      tracker.freezeDocument("first", app.id, {
        requestId: uuid(),
        source: "account",
        resumeId: theirs.id,
        revision: theirs.revision,
      }),
      status(404),
    );
    const mine = await saveResume("first", createDocument(true), null);
    await assert.rejects(
      tracker.freezeDocument("first", app.id, {
        requestId: uuid(),
        source: "account",
        resumeId: mine.id,
        revision: mine.revision + 1,
      }),
      code("REVISION_CONFLICT"),
    );

    // Review finding 6, account CV: export revision N, save N+1, then record — the frozen copy is still N.
    const revisionN = mine;
    const accountReceipt = await tracker.exportReceipt(
      "first",
      {
        kind: "resume",
        format: "pdf",
        source: {
          storage: "account",
          documentId: revisionN.id,
          revision: revisionN.revision,
        },
      },
      revisionN,
    );
    assert.ok(accountReceipt);
    const revisionN1 = await saveResume(
      "first",
      {
        ...revisionN,
        contact: { ...revisionN.contact, name: "Edited After Export" },
      },
      revisionN.revision,
    );
    assert.equal(revisionN1.revision, revisionN.revision + 1);
    const recorded = await tracker.createApplication("first", {
      requestId: uuid(),
      company: "Receipt Co",
      role: "Designer",
    });
    const frozenAccount = await tracker.freezeDocument("first", recorded.id, {
      requestId: uuid(),
      source: "snapshot",
      snapshotId: accountReceipt!,
    });
    assert.equal(frozenAccount.content.kind, "cv");
    assert.equal(
      frozenAccount.content.kind === "cv" &&
        frozenAccount.content.document.revision,
      revisionN.revision,
    );
    assert.equal(
      frozenAccount.content.kind === "cv" &&
        frozenAccount.content.document.contact.name,
      revisionN.contact.name,
    );
    assert.equal(frozenAccount.exportSnapshotId, accountReceipt);
    assert.equal(frozenAccount.sourceRevision, revisionN.revision);
    assert.equal(
      (await tracker.getExportSnapshot("first", accountReceipt!)).claimed,
      true,
    );

    // Device CV: the exported device document is kept even if the editor changes it afterwards.
    const deviceDoc = createDocument(true);
    deviceDoc.contact.name = "Device Exported Name";
    const deviceReceipt = await tracker.exportReceipt(
      "first",
      {
        kind: "resume",
        format: "docx",
        source: {
          storage: "device",
          document: deviceDoc,
          processingConsent: true,
        },
      },
      deviceDoc,
    );
    deviceDoc.contact.name = "Edited In Browser";
    const frozenDevice = await tracker.freezeDocument("first", recorded.id, {
      requestId: uuid(),
      source: "snapshot",
      snapshotId: deviceReceipt!,
    });
    assert.equal(
      frozenDevice.content.kind === "cv" &&
        frozenDevice.content.document.contact.name,
      "Device Exported Name",
    );
    assert.equal(frozenDevice.sourceResumeId, null);

    // Edited cover letter: the text as edited at export time is kept.
    const letterReceipt = await tracker.exportReceipt(
      "first",
      {
        kind: "letter",
        format: "md",
        text: "Edited letter text as exported.",
        name: "Receipt-Co-Cover-Letter",
        source: {
          storage: "account",
          documentId: revisionN1.id,
          revision: revisionN1.revision,
        },
      },
      revisionN1,
    );
    const frozenLetter = await tracker.freezeDocument("first", recorded.id, {
      requestId: uuid(),
      source: "snapshot",
      snapshotId: letterReceipt!,
    });
    assert.equal(frozenLetter.kind, "cover_letter");
    assert.equal(
      frozenLetter.content.kind === "cover_letter" && frozenLetter.content.text,
      "Edited letter text as exported.",
    );
    assert.equal(
      frozenLetter.content.kind === "cover_letter" &&
        frozenLetter.content.document?.contact.photoUrl,
      "",
    );

    // JSON backups and frozen-copy re-exports create no receipt.
    assert.equal(
      await tracker.exportReceipt(
        "first",
        {
          kind: "resume",
          format: "json",
          source: {
            storage: "account",
            documentId: revisionN1.id,
            revision: revisionN1.revision,
          },
        },
        revisionN1,
      ),
      null,
    );
    assert.equal(
      await tracker.exportReceipt(
        "first",
        {
          kind: "resume",
          format: "pdf",
          source: {
            storage: "frozen",
            applicationId: recorded.id,
            documentId: frozenDevice.id,
          },
        },
        revisionN1,
      ),
      null,
    );
    // Snapshots are owner-scoped.
    await assert.rejects(
      tracker.freezeDocument("second", recorded.id, {
        requestId: uuid(),
        source: "snapshot",
        snapshotId: accountReceipt!,
      }),
      code("APPLICATION_NOT_FOUND"),
    );
    await assert.rejects(
      tracker.getExportSnapshot("second", accountReceipt!),
      code("EXPORT_SNAPSHOT_NOT_FOUND"),
    );

    // Unclaimed snapshots expire and are deleted; the 21st unclaimed one drops the oldest; dismiss deletes.
    const expiring = (await tracker.exportReceipt(
      "first",
      {
        kind: "resume",
        format: "txt",
        source: {
          storage: "device",
          document: deviceDoc,
          processingConsent: true,
        },
      },
      deviceDoc,
    ))!;
    await client.execute({
      sql: "UPDATE export_snapshots SET expires_at=? WHERE id=?",
      args: [new Date(Date.now() - 1000).toISOString(), expiring],
    });
    await assert.rejects(
      tracker.freezeDocument("first", recorded.id, {
        requestId: uuid(),
        source: "snapshot",
        snapshotId: expiring,
      }),
      code("EXPORT_SNAPSHOT_NOT_FOUND"),
    );
    assert.equal(await tracker.purgeExpiredSnapshots(), 1);
    const unclaimed = async () =>
      (
        await client.execute(
          "SELECT id FROM export_snapshots WHERE owner_id='first' AND claimed_at IS NULL ORDER BY created_at, rowid",
        )
      ).rows.map((r) => String(r.id));
    assert.equal((await unclaimed()).length, 0);
    const created: string[] = [];
    for (let i = 0; i < APPLICATION_LIMITS.unclaimedSnapshots + 1; i++)
      created.push(
        (await tracker.exportReceipt(
          "first",
          {
            kind: "resume",
            format: "txt",
            source: {
              storage: "device",
              document: deviceDoc,
              processingConsent: true,
            },
          },
          deviceDoc,
        ))!,
      );
    const kept = await unclaimed();
    assert.equal(kept.length, 20);
    assert.equal(kept.includes(created[0]), false);
    assert.equal(kept.includes(created[20]), true);
    await tracker.deleteExportSnapshot("first", created[20]);
    assert.equal((await unclaimed()).includes(created[20]), false);
    const claimedStillThere = (
      await client.execute(
        "SELECT count(*) AS n FROM export_snapshots WHERE owner_id='first' AND claimed_at IS NOT NULL",
      )
    ).rows[0].n;
    assert.equal(Number(claimedStillThere), 3); // Claimed receipts are not counted against the 20.

    // Photo: kept when within 512 KB; replaced by a flag when the copy would exceed it.
    const small = createDocument(true);
    small.contact.photoUrl = "data:image/png;base64," + "A".repeat(1000);
    const withPhoto = await tracker.freezeDocument("first", app.id, {
      requestId: uuid(),
      source: "device",
      document: small,
    });
    assert.equal(withPhoto.photoOmitted, false);
    assert.equal(
      withPhoto.content.kind === "cv" &&
        withPhoto.content.document.contact.photoUrl,
      small.contact.photoUrl,
    );
    const large = createDocument(true);
    large.contact.photoUrl = "data:image/jpeg;base64," + "A".repeat(600_000);
    const withoutPhoto = await tracker.freezeDocument("first", app.id, {
      requestId: uuid(),
      source: "device",
      document: large,
    });
    assert.equal(withoutPhoto.photoOmitted, true);
    assert.equal(
      withoutPhoto.content.kind === "cv" &&
        withoutPhoto.content.document.contact.photoUrl,
      "",
    );
    assert.equal(
      withoutPhoto.content.kind === "cv" &&
        withoutPhoto.content.document.contact.name,
      large.contact.name,
    );
    assert.equal(
      (await tracker.getApplication("first", app.id)).documents.find(
        (d) => d.id === withoutPhoto.id,
      )?.photoOmitted,
      true,
    );

    // Review finding 9: a lost-response retry returns the same document; a changed body is 409.
    const letterFreeze = {
      requestId: uuid(),
      source: "letter" as const,
      text: "Dear team, I would like to apply.",
      name: "Synthetic-Cover-Letter",
      resumeId: revisionN1.id,
    };
    const firstTry = await tracker.freezeDocument(
      "first",
      app.id,
      letterFreeze,
    );
    const retry = await tracker.freezeDocument("first", app.id, letterFreeze);
    assert.equal(retry.id, firstTry.id);
    assert.deepEqual(retry, firstTry);
    assert.equal(
      (await tracker.getApplication("first", app.id)).documents.length,
      3,
    );
    await assert.rejects(
      tracker.freezeDocument("first", app.id, {
        ...letterFreeze,
        text: "Changed",
      }),
      code("APPLICATION_CHANGED"),
    );
    // Concurrent retries at 4 of 5 documents create exactly one.
    const fourth = await tracker.freezeDocument("first", app.id, {
      requestId: uuid(),
      source: "account",
      resumeId: revisionN1.id,
      revision: revisionN1.revision,
    });
    assert.equal(
      (await tracker.getApplication("first", app.id)).documents.length,
      4,
    );
    const concurrent = {
      requestId: uuid(),
      source: "letter" as const,
      text: "Concurrent retry letter.",
      name: "Concurrent",
    };
    const results = await Promise.all(
      [1, 2, 3, 4].map(() =>
        tracker.freezeDocument("first", app.id, concurrent),
      ),
    );
    assert.equal(new Set(results.map((r) => r.id)).size, 1);
    assert.equal(
      (await tracker.getApplication("first", app.id)).documents.length,
      5,
    );
    await assert.rejects(
      tracker.freezeDocument("first", app.id, {
        requestId: uuid(),
        source: "letter",
        text: "Sixth",
        name: "Sixth",
      }),
      code("APPLICATION_LIMIT"),
    );
    assert.equal(
      (await tracker.freezeDocument("first", app.id, concurrent)).id,
      results[0].id,
    ); // Retry still works at the limit.
    // Distinct concurrent freezes at 4 of 5: exactly one succeeds.
    const race = await tracker.createApplication("first", {
      requestId: uuid(),
      company: "Race Co",
      role: "Engineer",
    });
    for (let i = 0; i < 4; i++)
      await tracker.freezeDocument("first", race.id, {
        requestId: uuid(),
        source: "letter",
        text: `Letter ${i}`,
        name: `L${i}`,
      });
    const settled = await Promise.allSettled(
      [1, 2, 3].map((i) =>
        tracker.freezeDocument("first", race.id, {
          requestId: uuid(),
          source: "letter",
          text: `Race ${i}`,
          name: `R${i}`,
        }),
      ),
    );
    assert.equal(settled.filter((r) => r.status === "fulfilled").length, 1);
    for (const rejected of settled.filter((r) => r.status === "rejected"))
      code("APPLICATION_LIMIT")((rejected as PromiseRejectedResult).reason);
    assert.equal(
      (await tracker.getApplication("first", race.id)).documents.length,
      5,
    );

    // Review finding 10: two submissions with different CV/letter pairs keep their own document IDs.
    const sentFirst = await tracker.createSubmission("first", recorded.id, {
      requestId: uuid(),
      sentAt: "2026-11-01T10:00:00.000Z",
      cvDocumentId: frozenAccount.id,
      letterDocumentId: frozenLetter.id,
    });
    assert.equal(sentFirst.application.stage, "applied"); // Sending a saved job moves it to Applied.
    assert.equal(sentFirst.application.appliedAt, "2026-11-01");
    assert.equal(sentFirst.submission.stageAtSend, "saved");
    const secondInput = {
      requestId: uuid(),
      sentAt: "2026-11-02T10:00:00.000Z",
      cvDocumentId: frozenDevice.id,
    };
    const sentSecond = await tracker.createSubmission(
      "first",
      recorded.id,
      secondInput,
    );
    assert.equal(
      (await tracker.createSubmission("first", recorded.id, secondInput))
        .submission.id,
      sentSecond.submission.id,
    );
    await assert.rejects(
      tracker.createSubmission("first", recorded.id, {
        ...secondInput,
        letterDocumentId: frozenLetter.id,
      }),
      code("APPLICATION_CHANGED"),
    );
    const withSubmissions = await tracker.getApplication("first", recorded.id);
    assert.equal(withSubmissions.sentCount, 2);
    const byId = new Map(withSubmissions.submissions.map((s) => [s.id, s]));
    assert.equal(
      byId.get(sentFirst.submission.id)?.cvDocumentId,
      frozenAccount.id,
    );
    assert.equal(
      byId.get(sentFirst.submission.id)?.letterDocumentId,
      frozenLetter.id,
    );
    assert.equal(
      byId.get(sentSecond.submission.id)?.cvDocumentId,
      frozenDevice.id,
    );
    assert.equal(byId.get(sentSecond.submission.id)?.letterDocumentId, null);
    const sentEvents = withSubmissions.events.filter((e) => e.kind === "sent");
    assert.deepEqual(
      sentEvents.map((e) => e.submissionId).sort(),
      [sentFirst.submission.id, sentSecond.submission.id].sort(),
    );
    // A CV from another application, or a letter given as the CV, is rejected.
    await assert.rejects(
      tracker.createSubmission("first", recorded.id, {
        requestId: uuid(),
        sentAt: new Date().toISOString(),
        cvDocumentId: fourth.id,
      }),
      code("APPLICATION_DOCUMENT_MISMATCH"),
    );
    await assert.rejects(
      tracker.createSubmission("first", recorded.id, {
        requestId: uuid(),
        sentAt: new Date().toISOString(),
        cvDocumentId: frozenLetter.id,
      }),
      code("APPLICATION_DOCUMENT_MISMATCH"),
    );
    // The database also rejects a sent event without a submission.
    await assert.rejects(
      client.execute({
        sql: "INSERT INTO application_events(owner_id,application_id,id,at,kind) VALUES ('first',?,?,?,'sent')",
        args: [recorded.id, uuid(), new Date().toISOString()],
      }),
      /CHECK constraint failed/,
    );
    // Frozen copies of other owners are not readable.
    await assert.rejects(
      tracker.getFrozenDocument("second", recorded.id, frozenAccount.id),
      code("APPLICATION_NOT_FOUND"),
    );
    assert.equal(
      (await tracker.getFrozenDocument("first", recorded.id, frozenAccount.id))
        .id,
      frozenAccount.id,
    );

    // The 500-application cap.
    const now = new Date().toISOString();
    for (let i = 0; i < APPLICATION_LIMITS.applicationsPerAccount; i++)
      await client.execute({
        sql: "INSERT INTO applications(owner_id,id,company,role,stage,stage_changed_at,request_hash,created_at,updated_at) VALUES ('bulk',?,?,?,'saved',?,'h',?,?)",
        args: [`bulk-${i}`, "Co", "Role", now, now, now],
      });
    await assert.rejects(
      tracker.createApplication("bulk", { requestId: uuid(), ...base }),
      code("APPLICATION_LIMIT"),
    );
    await tracker.deleteApplication("bulk", "bulk-0");
    assert.equal(
      (await tracker.createApplication("bulk", { requestId: uuid(), ...base }))
        .company,
      base.company,
    );

    // Account export includes every tracker table and unclaimed export snapshots.
    const exported = await tracker.exportApplicationData("first");
    assert.ok(exported.applications.length >= 3);
    assert.ok(exported.applicationEvents.length >= 5);
    assert.ok(exported.applicationDocuments.length >= 10);
    assert.equal(exported.applicationSubmissions.length, 2);
    assert.ok(exported.exportSnapshots.some((s) => s.claimed_at === null));
    assert.equal(JSON.stringify(exported).includes("request_hash"), false);
    assert.equal(
      (
        exported.applications.find((a) => a.id === app.id) as {
          contacts: unknown[];
        }
      ).contacts.length,
      1,
    );
    const route = await readFile("src/app/api/account/export/route.ts", "utf8");
    assert.match(route, /exportApplicationData\(user\.id, tx\)/);
    assert.match(route, /\.\.\.tracker/);
    assert.equal(
      (await tracker.exportApplicationData("second")).applications.length,
      0,
    );

    // Metadata-only logging: never company names, notes or contacts.
    const logs = JSON.stringify(getLogBuffer());
    assert.ok(
      getLogBuffer().some(
        (entry) => entry.event === "application_document_frozen",
      ),
    );
    for (const secret of [
      "Synthetic Labs",
      "Receipt Co",
      "Private note",
      "Sam Contact",
      "sam@example.test",
      "Dear team",
    ])
      assert.equal(logs.includes(secret), false, secret);

    // Deleting an application cascades its events, documents and submissions.
    await tracker.deleteApplication("first", recorded.id);
    for (const table of [
      "application_events",
      "application_documents",
      "application_submissions",
    ])
      assert.equal(
        Number(
          (
            await client.execute({
              sql: `SELECT count(*) AS n FROM ${table} WHERE application_id=?`,
              args: [recorded.id],
            })
          ).rows[0].n,
        ),
        0,
        table,
      );

    // Deleting the user cascades every tracker table and export snapshot.
    await client.execute("DELETE FROM user WHERE id='first'");
    for (const table of [
      "applications",
      "application_events",
      "application_documents",
      "application_submissions",
      "export_snapshots",
    ])
      assert.equal(
        Number(
          (
            await client.execute(
              `SELECT count(*) AS n FROM ${table} WHERE owner_id='first'`,
            )
          ).rows[0].n,
        ),
        0,
        table,
      );
    assert.equal(
      (await client.execute("PRAGMA foreign_key_check")).rows.length,
      0,
    );
  } finally {
    client.close();
    delete process.env.TURSO_DATABASE_URL;
  }
});

test("npm run db:setup applies 008 once on an existing database and records its checksum", async () => {
  const run = promisify(execFile);
  const dir = await mkdtemp(path.join(tmpdir(), "cv-migrate-"));
  try {
    await mkdir(path.join(dir, "migrations"));
    const all = (await readdir("migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort();
    for (const name of all.filter((n) => n < "008"))
      await copyFile(`migrations/${name}`, path.join(dir, "migrations", name));
    const env = {
      ...process.env,
      TURSO_DATABASE_URL: `file:${path.join(dir, "existing.db")}`,
      NODE_ENV: "development" as const,
    };
    const script = path.resolve("scripts/setup-db.mjs");
    await run(process.execPath, [script], { cwd: dir, env });
    for (const name of all.filter((n) => n >= "008"))
      await copyFile(`migrations/${name}`, path.join(dir, "migrations", name));
    const first = await run(process.execPath, [script], { cwd: dir, env });
    assert.match(first.stdout, /Migration ready: 008-applications\.sql/);
    await run(process.execPath, [script], { cwd: dir, env }); // A second run is a no-op.
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: env.TURSO_DATABASE_URL });
    try {
      const rows = (
        await db.execute(
          "SELECT name,checksum FROM schema_migrations WHERE name='008-applications.sql'",
        )
      ).rows;
      assert.equal(rows.length, 1);
      const { createHash } = await import("node:crypto");
      const sql = (
        await readFile("migrations/008-applications.sql", "utf8")
      ).replace(/\r\n/g, "\n");
      assert.equal(
        rows[0].checksum,
        createHash("sha256").update(sql).digest("hex"),
      );
      const tables = (
        await db.execute(
          "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'application%' OR name='export_snapshots') ORDER BY name",
        )
      ).rows.map((r) => r.name);
      assert.deepEqual(tables, [
        "application_documents",
        "application_events",
        "application_submissions",
        "applications",
        "export_snapshots",
      ]);
      const columns = (
        await db.execute("PRAGMA table_info(applications)")
      ).rows.map((r) => String(r.name));
      for (const column of [
        "employment_type",
        "salary_text",
        "deadline_at",
        "requirements",
        "captured_via",
        "referral_contact_id",
        "switch_from",
        "switch_to",
      ])
        assert.ok(columns.includes(column), column);
    } finally {
      db.close();
    }
    assert.equal(
      (await readFile("migrations/008-applications.sql", "utf8")).includes(
        "\r\n",
      ),
      false,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
