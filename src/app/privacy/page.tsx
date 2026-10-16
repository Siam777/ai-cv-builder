import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import styles from "@/components/public/public-site.module.css";
export const metadata: Metadata = { title: "Data & privacy · AI CV Builder" };
export default function Privacy() {
  return (
    <PublicShell>
      <article className={styles.information}>
        <h1>Know where your resume goes.</h1>
        <p>
          This page describes current application behavior. Deployment-specific
          providers and their retention settings still require validation before
          a public release.
        </p>
        <h2>On this device</h2>
        <p>
          Device CVs are saved in this browser profile using browser storage.
          Other people using the same profile may see them. Clearing browser
          data can remove these drafts. Signing in does not upload them
          automatically.
        </p>
        <h2>In your account</h2>
        <p>
          Account CVs are stored on the application's database. Copying device
          CVs into the account is an explicit action; local originals remain.
          Account requests check the current session and document ownership.
        </p>
        <h2>Google sign-in</h2>
        <p>
          Where configured, Google provides your account identity, email,
          verification status and basic profile for sign-in. The application
          requests identity scopes, not Google Drive or Gmail access. Existing
          accounts link Google explicitly in Account settings using the same
          verified email. Google profile information is not inserted into your
          CV.
        </p>
        <h2>Uploads and exports</h2>
        <p>
          PDF/DOCX/TXT file uploads are sent to the application server for
          parsing. File diagnostics can also send the current CV for source
          comparison after your confirmation. Uploads and results are used for
          the request without saving them to your account or sending them to an
          AI provider. Pasted public-review text is processed in the browser.
          All app downloads require sign-in; CV, letter, backup and app
          print/copy exports also require verified email. Device exports send a
          validated snapshot to the server after your confirmation, without
          saving it to your account.
        </p>
        <h2>Saved job reviews</h2>
        <p>
          Job reviews run locally until you explicitly save one for an account
          CV. Saving sends the posting and reviewed priorities to the
          application server, which rechecks the owned CV and stores the
          posting, cited excerpts, hashes, versions and analysis time. No AI
          provider receives this history. Reports stay until you delete them,
          delete their CV or delete the account; independent variants keep their
          own records. History is limited to 20 reports per CV and 100 per
          account, with no automatic removal. Account-data export includes saved
          reports. Device-only reviews remain temporary.
        </p>
        <h2>AI suggestions</h2>
        <p>
          AI writing help works on account CVs and is off until you turn it on
          (asked once, kept on your account, and switchable in Account
          settings, Data &amp; privacy). While it is on, each AI action sends only
          what it needs: a bullet rewrite sends the selected entry&apos;s bullets
          and instruction; Write with AI sends your notes and that entry&apos;s
          title, organization and bullets; examples for a job title send only
          the job title. Contact details are removed and never sent. Suggestions are
          reviewed before acceptance. Provider retention depends on the deployed
          provider's account settings; no zero-retention guarantee is made.
        </p>
        <p>
          Where configured, criterion coaching also asks for consent to send one
          selected job criterion, target role, seniority, language and company,
          selected entry bullets and your instruction to OpenAI. The full
          posting goes to the app server to validate the criterion; contact
          fields, other entries and the full posting are excluded from provider
          requests. Separate model checks assess interpretation and
          candidate-only rewrite support. They can make mistakes. Coaching
          proposals and original entry evidence stay in your account until
          rejection or CV/account deletion, and are included in account-data
          export. Coaching does not change local coverage counts or verify
          qualifications.
        </p>
        <h2>Export or delete account data</h2>
        <p>
          <Link href="/profile">Account settings</Link> offers an authenticated
          account-data download and deletion with explicit confirmation and your
          password, or a Google-only sign-in from the last ten minutes.
          Account-data downloads remain available before email verification.
          Deleting the account removes its active application records;
          independent browser copies remain. Operator/provider backups follow
          their configured retention policies.
        </p>
        <h2>Operational limits</h2>
        <p>
          Resume text is excluded from routine application logs. Live email,
          hosting, database backups and provider behavior have not been
          validated in this workspace. Browser-native copying, screenshots and
          OS printing of visible content cannot be prevented by the application.
        </p>
        <Link href="/help">Get help with saving and exporting</Link>
      </article>
    </PublicShell>
  );
}
