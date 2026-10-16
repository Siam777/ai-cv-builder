import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import styles from "@/components/public/public-site.module.css";
export const metadata: Metadata = { title: "Help · AI CV Builder" };
export default function Help() {
  return (
    <PublicShell>
      <article className={styles.information}>
        <h1>Start, save, and export.</h1>
        <h2>Build your first CV</h2>
        <p>
          Open the library and choose <strong>Help me start</strong>. Add your
          introduction and one job, project or course, then check the facts and
          create your draft. Each line of experience becomes a bullet. Add more
          entries, dates and sections in the editor.
        </p>
        <h2>Add your photo</h2>
        <p>
          Choose <strong>Add or change photo</strong> in the editor, then Upload
          photo. Use a JPG, PNG or WebP smaller than 5 MB. If your design omits
          photos, the editor tells you; choose Switch to a photo design and pick
          a design marked Photo. Check the preview; Word and text exports omit
          photos.
        </p>
        <h2>Get help with your wording</h2>
        <p>
          <strong>Writing help</strong> offers four actions. Rewrite a bullet
          uses OpenAI for an account CV once you turn on AI writing help. The summary, result
          and skill helpers run locally. You preview changes before using them,
          and Undo can restore earlier wording.
        </p>
        <p>
          For an AI rewrite, start beside a bullet with Improve this bullet. For
          a device draft, sign in and explicitly copy it to your account first.
          Writing preferences cannot add new experience; put confirmed facts
          into the original bullet before requesting a rewrite.
        </p>
        <h2>Choose the right review</h2>
        <p>
          <strong>Check my CV</strong> starts with content findings you can
          click to fix. Role checklist compares your CV with common terms for a
          role you choose. File diagnostics checks an exported file.{" "}
          <strong>Compare with a job</strong> uses a pasted posting to show
          matching evidence and gaps; it can create a separate copy with
          reviewed bullet ordering.
        </p>
        <h2>Find an existing draft</h2>
        <p>
          <Link href="/builder">Open your CV library</Link> in the same browser
          profile where you edited. Device drafts remain in that browser;
          signing in does not automatically copy them to an account. Review
          older drafts if their purpose has not been classified.
        </p>
        <h2>Start with a design</h2>
        <p>
          <Link href="/templates">Inspect a template</Link>, choose it, then
          create a resume in the library. The new CV has empty personal details.
          Demo examples are fictional and stay separate from personal CVs.
        </p>
        <h2>Import carefully</h2>
        <p>
          The builder restores JSON backups and offers a reviewed import flow.
          Text-based PDF/TXT and LinkedIn CSV/ZIP support is limited by the
          source format. Scanned PDFs and DOCX import are not available. Check
          all parsed fields before saving or replacing content.
        </p>
        <h2>Download your resume</h2>
        <p>
          Sign in, verify your email and choose a format from Export. Exporting
          a device draft asks permission to process it on the application
          server. Free PDF/Word exports have a watermark. Check the saved file
          before submitting it. PDF and HTML use the preview's template and
          pagination rules. Word uses an editable single-column layout with your
          font, color, spacing and page settings; decorative rails and photos
          are omitted, and Word may wrap text differently.
        </p>
        <h2>Verification or recovery email did not arrive?</h2>
        <p>
          Check your spam folder and request another verification link or
          password reset from <Link href="/profile">Account settings</Link>. If
          the application reports that email is not configured, live delivery
          requires setup by the operator. Local test outbox mode does not
          deliver email.
        </p>
        <h2>Keep a draft safe</h2>
        <p>
          Wait for the saved status before leaving. If your account session
          changes, keep the editor tab open; restore the original session or use
          Keep draft on this device. Closing an unsaved tab can lose in-memory
          edits. Download a verified JSON backup before clearing browser data.
        </p>
        <h2>Review findings with care</h2>
        <p>
          Writing rules and job term overlap do not verify qualifications,
          predict hiring or inspect every exported file. Compare the findings
          with your source material.{" "}
          <Link href="/privacy">Read how data is handled</Link>.
        </p>
        <h2>About</h2>
        <p>AI CV Builder is developed by Elfasys Solution.</p>
      </article>
    </PublicShell>
  );
}
