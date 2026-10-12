import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { DesignSamples } from "@/components/public/DesignSamples";
import { publicDesigns } from "@/lib/public-catalog";
import styles from "@/components/public/public-site.module.css";
export function generateStaticParams() {
  return publicDesigns.map((item) => ({ slug: item.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const design = publicDesigns.find((item) => item.id === slug);
  return { title: `${design?.name ?? "Design not found"} · Resume templates` };
}
export default async function TemplateDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const design = publicDesigns.find((item) => item.id === slug);
  if (!design) notFound();
  return (
    <PublicShell active="/templates">
      <div className={styles.detail}>
        <div className={styles.detailCopy}>
          <Link href="/templates">All designs</Link>
          <h1>{design.name}</h1>
          <p>{design.description}</p>
          <span className={styles.sampleTag}>
            Fictional content · view-only preview
          </span>
          <p>
            This sample uses the current editor renderer. Choosing the design
            starts with empty personal details and sections.
          </p>
          <Link
            href={`/builder?template=${design.id}`}
            className={styles.button}
          >
            Use this design
          </Link>
          <h2>Make it yours</h2>
          <ul>
            <li>
              Choose A4 or Letter, bounded text sizes, spacing and accent
              colors.
            </li>
            <li>Keep your content when changing designs.</li>
            <li>
              Export PDF, Word, HTML, Markdown, text or JSON after sign-in and
              email verification.
            </li>
          </ul>
          <h2>Know the limits</h2>
          <p>
            Local export checks cover all twelve designs on A4 and Letter, short
            and long content and density extremes. They verify source-text
            order, page size and links; they do not certify every receiving
            parser.
          </p>
          <p>
            Reading order and ATS compatibility depend on the actual file and
            receiving system. PDF and HTML use the preview's template and
            pagination rules. Word is an editable single-column document; photos
            and decorative rails are omitted, and wrapping can differ. Inspect
            your export before sending it.
          </p>
        </div>
        <DesignSamples template={design.id} />
      </div>
    </PublicShell>
  );
}
