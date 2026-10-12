# Q2.3 Google sign-in and account navigation

Date: 2026-10-10 (Asia/Dhaka)
Status: implemented locally. Live Google configuration/consent validation remains open; acceptance evidence is recorded in PLAN.md.

## Identity and ownership

Google is registered with the installed Better Auth provider only when both server-only credentials are present. Its base URL is the exact APP_ORIGIN; the callback is `/api/auth/callback/google`. The app requests basic identity scopes and asks the user to choose an account. It exposes availability, linked-provider and password-presence flags, not provider secrets or tokens. OAuth starts pass through Better Auth's HTTP handler to retain its rate limiting; the existing shared-enforcement staging gate remains open.

Existing users link Google explicitly while authenticated with a verified account email and a session less than ten minutes old. Different-email linking and implicit matching-email merges are disabled; local account/profile/CV identity is preserved. The start endpoint checks origin, body limits and workspace ownership for linking; Better Auth retains OAuth state, PKCE and callback processing. The catch-all exposes only the existing verification/reset GETs and the Google callback, not arbitrary authentication methods.

Google-only accounts have a password-setup action using the existing single-use email recovery flow. Reset revokes sessions and retains the Google link. Account deletion still checks origin, workspace and the exact confirmation phrase. Password accounts require their current password; Google-only accounts require a sign-in from the last ten minutes. No schema migration or new account-data export policy is introduced.

## Draft and navigation behavior

Sign-in opens a separate window during the user's click, then flushes edits where required. The parent remains mounted with current facts, undo history and pending export. Completion messages are bounded to the application's origin and the specific child/flow; the parent reads the server session before continuing. Popup blocking, cancellation, closure, timeout and provider failures report that the draft is retained. A browser that isolates the sign-in window can use the existing Account refresh/Continue export controls.

Authenticating while a device CV is open retains that tab's device workspace choice on reload for both Google and email sign-in. Account sign-in does not copy device CVs. A different Google identity pauses the original account workspace under the existing session lifecycle; the candidate must restore its session or keep a device copy before switching. Failed persistence blocks sign-in when a normal workspace flush is required; recovery/pending exports retain their existing snapshot path.

Account settings provide Profile, Plans, Help and Data & privacy links. Normal header/account navigation flushes the draft before leaving and stays in place after a failed save. Modified/new-tab links retain normal browser behavior; their original editor remains open. Google identity fields are not inserted into a CV. The public data page explains current Google scope and deletion behavior.

## Local verification and reproduction

Final validation passed: typecheck, 89 unit tests, the isolated production build (`NEXT_DIST_DIR=.next-e2e`), and the full configured-provider suite (76 tests, 5.2 minutes; unconfigured case intentionally skipped). A separate unconfigured-provider run passed (one test, 14.3 seconds). The final focused Google run passed ten tests (1.2 minutes). All 48 preview/print PDF audits and the 121-state baseline overflow measurements passed. Feature scope, its distribution copy and all 15 ZIP entries agree; `git diff --check` passed. The isolated test server stopped and the normal port 3000 editor remains available. Google availability in the normal local account API is false until credentials are supplied.

Use `E2E_GOOGLE=1` for configured-provider tests. `scripts/e2e-google-fetch.mjs` is loaded only by the isolated development test server and rejects production or non-test database/origin settings. It substitutes Google's token/certificate transport with synthetic identities and verifies the code verifier against the authorization challenge. Browser consent pages are intercepted by Playwright. Better Auth's actual state/callback, sessions and database operations are exercised; no live Google credentials or requests are used. Run the unconfigured test without this flag.

Coverage includes three responsive widths, pending-export continuation, unchanged device facts/undo, reload choice, no automatic account uploads, blocked/closed/denied sign-in, unverified-email export denial, explicit matching-email linking, wrong-email rejection, original account owner/content, password setup, recent-session deletion, origin/forged-state/foreign-workspace rejection, expired linking, failed saves, changed Google identity, recovery to a device copy and actual 429 rate-limit responses. Tests use separate synthetic proxy-IP buckets for independent browser users; the rate-limit test deliberately shares one bucket. Six synthetic account captures are written to `test-results/google-auth/` with horizontal-overflow assertions and were manually reviewed at all three widths.

## Live gates and remaining scope

Configure a Google Web OAuth client with local and production callback URIs, consent branding/audience and deployment credentials; then validate actual approval/cancellation/account selection, cookie behavior and popup/tab behavior in supported browsers and staging HTTPS. This work does not claim live Google validation. Local typography/toolbar/keyboard work was subsequently delivered in [Q2.4](q2-editor-polish-review.md). Q1 live email, Q3 renderer parity, Q4 diagnostics/evaluations and Q5 human accessibility/operational release gates remain open.

References checked against installed Better Auth 1.7.5 and current primary documentation: [Google provider setup](https://better-auth.com/docs/authentication/google), [users and accounts](https://better-auth.com/docs/concepts/users-accounts). Release scope and skill guidance are unchanged.
