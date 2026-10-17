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
          AI writing help needs an account and is off until you turn it on. You
          are asked once; the choice is kept on your account and can be switched
          off in Account settings, Data &amp; privacy. While it is on, each AI
          action sends only what it needs to OpenAI. Contact details (email,
          phone, website) and photos are never sent, and are removed from notes
          and questions you type. Nothing is added to your CV until you accept
          it, and Undo reverses what you accept.
        </p>
        <ul>
          <li>
            <strong>Bullet help</strong> (Improve wording, Shorten, Continue
            writing, Rewrite selection, Improve all bullets, Fix with AI): that
            job&apos;s bullets and the instruction.
          </li>
          <li>
            <strong>Write with AI on a job or project</strong>: your notes, any
            duties you paste, and that entry&apos;s title, organization and
            bullets.
          </li>
          <li>
            <strong>Examples for a job title</strong>: only the job title and the
            level you choose. The examples are kept for 30 days and reused for
            anyone who asks for the same title and level; they are not linked to
            your account and contain nothing from your CV.
          </li>
          <li>
            <strong>Summary, Suggest skills and Ask the AI</strong>: your
            headline, job titles, organizations, bullets, education, projects and skills,
            plus your question for Ask the AI and the last few questions and
            answers on screen.
          </li>
          <li>
            <strong>Build my CV with AI (interview)</strong>: each answer you
            give, one step at a time. Your name is not sent. The account keeps a
            record that an interview was started (Free includes one), and that
            record is in your account-data download.
          </li>
          <li>
            <strong>Match with AI and Tailor with AI</strong>: the job title,
            company and job post, plus your CV text as above. A line you write
            about a requirement is sent to suggest where it goes.
          </li>
          <li>
            <strong>Write a cover letter with AI</strong>: the job details, your
            optional note on why you want the job, and your CV text as above.
          </li>
          <li>
            <strong>Tidy with AI</strong> after an import: the imported CV&apos;s
            sections and entries before they are saved, without contact details
            or photo. It may only move, split and date items; your wording is not
            changed.
          </li>
        </ul>
        <p>
          AI results are returned to your editor and are not stored on the
          server, except bullet suggestions waiting for your decision (with the
          bullets they cite), which stay in your account until you decide or
          delete the CV or account and are included in account-data export. The
          server counts AI requests per day for plan limits and logs only
          metadata such as timings and error codes, never your text. Independent
          checks look for unsupported claims and invented numbers, but they can
          make mistakes, so read every suggestion before you accept it. Provider
          retention depends on the deployed provider&apos;s account settings; no
          zero-retention guarantee is made.
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
