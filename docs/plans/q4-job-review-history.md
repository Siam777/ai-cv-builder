# Q4 saved job-review history

Status: third local Q4 slice, 2026-10-11. Implementation and local verification passed. PLAN.md owns implementation progress. Release scope and distributed skill guidance are unchanged. Q4 remains partial.

## Stored records and consent

Account CVs can explicitly save the current job review after confirming retention of the posting and cited CV excerpts. Device reviews remain temporary; signing in alone does not upload them. The save request contains the posting, target context, reviewed priority overrides, hashes, versions, source ID/revision and an immutable request UUID. It cannot submit evidence, counts or proposed CV edits. The server reconstructs the report from the owned saved CV inside a write transaction and validates its source/hash/rules and override IDs before committing.

Schema version 1 records preserve the raw posting, exact criterion source spans, reviewed priorities and their origin, evidence excerpts with section/entry/bullet or field identities, separated coverage groups, warnings, rule/term versions, analysis/save timestamps and source/posting SHA-256. The method is `local_text_rules`; model/prompt versions are explicitly null. No full CV snapshot, contact object or photo is copied into history. Cited CV content may itself contain candidate-entered personal information; the retention checkbox includes those excerpts. No AI provider is called.

The additive checksum-tracked migration `005-job-review-history.sql` uses composite owner/report keys and owner/CV foreign keys. API list/detail/save/delete operations require the existing session and workspace-owner boundary. Mutations require same origin. Responses are non-cacheable. Save inputs are limited to 128 KB, posting text to 20,000 characters, and the existing matching bounds still apply. Reports are limited to 512 KB, 20 per CV and 100 per account; these are enforced inside the save transaction. Saves are process-locally rate limited to 20/minute/account. Quota overflow rejects the new save; no automatic pruning or expiry occurs.

## History, retry and data controls

Lists return summaries; a selected report opens read-only. Both server and current browser draft detect stale source hashes, and server rule/term changes also mark historical reports stale. Rechecking restores the posting and target input, clears acceptance, and requires a fresh target confirmation and local analysis against the current CV. Reviewed priority overrides remain visible in history; the new analysis requires reviewing priorities again. Historical reports cannot directly apply CV changes or reuse old ordering proposals.

The UI retains the same request UUID after an unconfirmed save. The server returns the immutable canonical record for an identical retry, even after later CV edits; reusing that UUID with changed inputs returns a conflict. Deletion is also idempotent within an owned CV, so a committed deletion with a lost response can be retried. Load errors do not masquerade as empty history, and failed history actions preserve the current CV and open review. A request generation guard prevents an older list response or error from replacing a newer refresh after saving.

Reports remain until explicitly deleted, their CV is deleted, or the account is deleted. Independent CV variants retain their own records. Existing account-data export includes all owned reports in its transaction. Deletion cascades are tested in SQLite; provider backups follow deployment retention policies. No remote migration or provider call occurred. The migration was applied to the configured local development database.

## Verification

Two unit scenarios exercise strict consent/input schemas, server evidence recomputation and overrides, immutable retries and changed-request conflicts, wrong-owner requests, CV/rule staleness, forged priorities/hash, oversized-report rejection, both history limits, export isolation, repeat deletion, and CV/account cascades with a clean foreign-key check.

Four new browser scenarios exercise consent, reload/reopen, read-only reviewed priorities, recheck confirmation, unchanged CV content, later staleness, mobile wrapping, account export, failed/committed-lost-response save and deletion recovery, real session/owner/origin enforcement, stale save rejection, CV deletion, failed initial loading and a delayed initial list arriving after a successful save. Fixtures use synthetic verified accounts in the isolated SQLite test database. The mobile stale-report capture is `test-results/job-history/mobile-stale-review.png`.

- `npm test`: all 112 tests passed. Expanded account-quota, report-size, prior-rule staleness and repeat-deletion assertions subsequently passed in the two focused storage scenarios.
- `npm run build`: passed in isolated `.next-q4-build`, including both new dynamic route handlers. Build-only type paths were removed after verification.
- Full `npm run test:e2e` with synthetic Google: 102 passed, one intentional unconfigured-provider skip (12.2 minutes). This run collected the original three history scenarios; all passed, including the lost deletion-response extension. The final five-case run passed (1.0 minute): all four history scenarios after the list-response guard and the unconfigured-provider case. All 104 distinct browser scenarios have successful results across the two configurations/runs; this is not a claim of 104 passing in one invocation. `npm run typecheck` passed after restoring normal generated type paths; `git diff --check` passed. The normal dev builder returned HTTP 200; the isolated test server stopped. The mobile stale report was visually inspected and horizontal overflow is asserted.

## Remaining work

Actual-file diagnostics are still request-only. Unified file/role analysis history, shared Master Career Vault projections, semantic interpretation and evidence-grounded writing/coaching through the existing AI proposal boundary, and the diverse 120-pair held-out evaluation remain open. This slice establishes durable local-rule job reports; it does not validate recruiting outcomes, live provider behavior, deployment or human accessibility/Word release gates.
