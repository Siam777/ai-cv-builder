import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import {
  ResumeShowcase,
  ResumeThumbnail,
} from "@/components/public/PublicResume";
import { designSample, publicDesigns } from "@/lib/public-catalog";
import styles from "@/components/public/public-site.module.css";

export const metadata: Metadata = {
  title: "AI CV Builder · Your experience, clearly presented",
  description:
    "Explore resume designs, draft with your own details, and review your content. Sign in to download.",
};
export default function Home() {
  return (
    <PublicShell>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <h1>Your experience. Clearly presented.</h1>
          <p>
            Give your career a thoughtful introduction. Choose a design, add
            your real experience, and make every word count.
          </p>
          <div className={styles.actions}>
            <Link href="/builder" className={styles.button}>
              Create my resume
            </Link>
            <Link
              href="/grader"
              className={`${styles.button} ${styles.secondary}`}
            >
              Review my resume
            </Link>
          </div>
          <p className={styles.accessNote}>
            Start editing without an account. Every CV download requires sign-in
            and a verified email.
          </p>
          <Link href="/builder" className={styles.returnLink}>
            Already have a draft? Open my CVs
          </Link>
        </div>
        <ResumeShowcase sample={designSample("classic")} />
      </section>
      <section className={styles.section} aria-labelledby="designs-heading">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="designs-heading">A design that lets your work speak.</h2>
            <p>Eight current styles. The same details, presented your way.</p>
          </div>
          <Link href="/templates">Browse all designs</Link>
        </div>
        <div className={styles.galleryGrid}>
          {publicDesigns
            .filter((item) =>
              [
                "classic",
                "modern",
                "creative",
                "tech",
                "executive",
                "minimalist",
              ].includes(item.id),
            )
            .map((item) => (
              <article className={styles.galleryCard} key={item.id}>
                <Link
                  href={`/templates/${item.id}`}
                  className={styles.previewLink}
                  aria-label={`Preview ${item.name}`}
                >
                  <ResumeThumbnail doc={designSample(item.id)} />
                </Link>
                <div className={styles.cardText}>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <Link
                    href={`/templates/${item.id}`}
                    className={styles.textLink}
                  >
                    Inspect design
                  </Link>
                </div>
              </article>
            ))}
        </div>
      </section>
      <section className={styles.section} aria-labelledby="journey-heading">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="journey-heading">
              From a first draft to a clear introduction.
            </h2>
            <p>Your facts stay yours at every step.</p>
          </div>
        </div>
        <ol className={styles.steps}>
          <li>
            <h3>Start with your experience</h3>
            <p>
              Create a blank CV or review an import. Examples give you a design
              to borrow, while the career details are your own.
            </p>
          </li>
          <li>
            <h3>Review and refine</h3>
            <p>
              Read writing findings, compare job terms and tailor an independent
              version. Review suggestions against what you actually did.
            </p>
          </li>
          <li>
            <h3>Sign in and export</h3>
            <p>
              Verify your email, confirm processing for a device draft, and
              choose PDF, Word, HTML, text, Markdown or a JSON backup.
            </p>
          </li>
        </ol>
      </section>
      <section className={styles.section}>
        <div className={styles.evidence}>
          <div>
            <h2>Better wording starts with real work.</h2>
            <p>
              This fictional example shows how clearer wording can preserve the
              original fact. It adds no employers, tools or invented results.
            </p>
            <Link href="/grader">Try the content review</Link>
          </div>
          <dl>
            <dt>Original resume bullet</dt>
            <dd>
              Built a shared component library with engineering to create a
              consistent product experience.
            </dd>
            <dt>Possible clearer wording</dt>
            <dd>
              Partnered with engineering to build a shared component library for
              a consistent product experience.
            </dd>
            <dt>What the evidence does not say</dt>
            <dd className={styles.missing}>
              No measured time savings or conversion lift. Ask for real evidence
              before adding a number.
            </dd>
          </dl>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.trust}>
          <div>
            <h2>Explore an example. Keep your own story.</h2>
            <p>
              Browse twelve fictional profiles in engineering, design,
              architecture, business and marketing. Inspect the full resume,
              then start a blank personal CV using its design.
            </p>
            <Link href="/examples">Explore fictional examples</Link>
          </div>
          <div>
            <h3>A clear view of your data</h3>
            <p>
              Device drafts stay in this browser. Signing in does not upload
              them automatically. Imports to your account are explicit; file
              uploads and authorized exports are processed on the application
              server.
            </p>
            <p>AI bullet suggestions require separate consent and review.</p>
            <Link href="/privacy">Read how your data is handled</Link>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.trust}>
          <div>
            <h2>Start with the tools already here.</h2>
            <p>
              Device editing includes multiple drafts, all twelve current designs
              and local writing tools. Free PDF and Word exports carry a
              watermark.
            </p>
            <Link href="/pricing">
              Review proposed plans and configured limits
            </Link>
          </div>
          <div>
            <h3>Check before you subscribe</h3>
            <p>
              Paid plans and their limits are still being validated. Payment and
              provider services need configuration and live testing before a
              public paid release.
            </p>
            <p>There are no interview guarantees or universal ATS scores.</p>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>A few useful answers.</h2>
        </div>
        <div className={styles.faq}>
          <details>
            <summary>Do I need an account to start?</summary>
            <p>
              You can edit and preview a device draft without signing in. Every
              app download requires an account; CVs, letters, recovery backups
              and app print/copy also require verified email.
            </p>
          </details>
          <details>
            <summary>Can I use my current resume?</summary>
            <p>
              Restore a JSON backup in the builder, or review supported
              text-based PDF/TXT and LinkedIn CSV/ZIP imports. Check extracted
              details and omissions before saving. Scanned PDFs and DOCX import
              are not supported.
            </p>
          </details>
          <details>
            <summary>Will my resume work with every ATS?</summary>
            <p>
              No tool can promise that. Current review findings check visible
              content and term overlap. They do not test your exported file
              against a particular employer's system or predict hiring outcomes.
            </p>
          </details>
          <details>
            <summary>Can my resume be more than one page?</summary>
            <p>
              Yes. The preview paginates longer content on A4 or Letter paper.
              Review the actual export: the current server PDF layout can differ
              from the editor preview.
            </p>
          </details>
        </div>
      </section>
      <section className={styles.finalCta}>
        <div>
          <h2>Make room for your next chapter.</h2>
          <p>Start with the experience you already have.</p>
        </div>
        <Link href="/builder" className={styles.button}>
          Start my resume
        </Link>
      </section>
    </PublicShell>
  );
}
