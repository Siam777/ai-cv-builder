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
          <strong>Check my CV</strong> opens with a 0–100 score that explains
          every point, compares your CV with common benchmarks, and lists the
          three fixes worth the most. Fix now jumps to the right section; the
          score in the toolbar updates as you edit. Writing findings lists
          each line to improve, Role checklist compares your CV with common
          terms for a role you choose, and File diagnostics checks an exported
          file. The score describes written content only; it does not predict
          ATS acceptance or hiring outcomes.{" "}
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
        <h2>Check that everything is consistent</h2>
        <p>
          <strong>Check my CV</strong> also reads your whole CV for statements
          that contradict or repeat each other, under{" "}
          <strong>Is everything consistent?</strong>. It runs in your browser
          and does not use AI. It looks for:
        </p>
        <ul>
          <li>End dates before start dates, end dates in the future, and jobs with no start date.</li>
          <li>Jobs that overlap by three months or more. Part-time and freelance work often overlaps, so confirm it if it is right.</li>
          <li>The same employer, school or job title written two ways, such as &ldquo;Sr. Engineer&rdquo; and &ldquo;Senior Engineer&rdquo;.</li>
          <li>Two bullets that say the same thing, and the same percentage or amount claimed in two roles.</li>
          <li>&ldquo;N years of experience&rdquo; in your headline or profile that is more than your job dates show.</li>
          <li>Skills you list that appear nowhere else in your CV.</li>
          <li>Numbers you should be ready to explain in an interview.</li>
        </ul>
        <p>
          Fix a finding, dismiss it, or confirm it is true. Changing the text
          brings it back. Confirmations are kept in this browser only. Before
          you download a CV, you are reminded of anything that needs attention;
          you can always export anyway. Employment gaps are{" "}
          <strong>not</strong> checked: a gap is not a contradiction, and you
          should not feel you have to hide one.
        </p>
        <h2 id="applications">Track your applications</h2>
        <p>
          <Link href="/applications">Applications</Link> keeps every job you
          apply for: its stage, dates, notes, the people you are in touch with,
          a reminder for your next step and a frozen copy of the CV and cover
          letter you sent. It needs an account and is free on every plan, up to
          500 applications.
        </p>
        <ul>
          <li>
            After you export a CV or letter, choose{" "}
            <strong>Record this as an application</strong>. The exact copy you
            downloaded is attached, even if you edit your CV before you finish
            the form. The app then asks <strong>Did you send it?</strong>: a
            saved copy is only marked as sent when you confirm it.
          </li>
          <li>
            The copy you sent is kept as it was. If you change your CV later,
            this copy does not change. Downloading it again renders it from the
            kept copy, which can look slightly different if a design changes
            later. A photo is left out of a frozen copy only when it would make
            the copy larger than 512 KB, and the copy says so.
          </li>
          <li>
            Reminders appear under <strong>Due</strong> at the top of the list
            and as a count on the account menu. There are no email reminders
            yet.
          </li>
          <li>
            <strong>Save this job to applications</strong> in Match a job and{" "}
            <strong>Attach to an application</strong> in the cover letter tool
            bring the job or letter across. <strong>Match this job</strong> on an
            application opens Match a job with the post filled in.
          </li>
          <li>
            Applications that have been &ldquo;Applied&rdquo; for 21 days with no
            change show &ldquo;No reply yet&rdquo;. Up to 5 frozen copies can be
            kept per application.
          </li>
        </ul>
        <p>
          The app never applies for jobs or contacts anyone for you, and
          nothing is sent to employers or job boards.
        </p>
        <h2>About</h2>
        <p>AI CV Builder is developed by Elfasys Solution.</p>
      </article>
    </PublicShell>
  );
}
