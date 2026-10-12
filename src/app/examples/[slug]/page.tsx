import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicResume } from "@/components/public/PublicResume";
import { DEMO_PROFILES, demoLearningExample } from "@/lib/demo-resumes";
import styles from "@/components/public/public-site.module.css";
export function generateStaticParams() {
  return DEMO_PROFILES.map((item) => ({ slug: item.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const example = DEMO_PROFILES.find((item) => item.id === slug);
  return {
    title: `${example?.name ?? "Example not found"} · Fictional resume example`,
  };
}
export default async function ExampleDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const example = DEMO_PROFILES.find((item) => item.id === slug);
  if (!example) notFound();
  const learning = demoLearningExample(example);
  return (
    <PublicShell active="/examples">
      <div className={styles.detail}>
        <div className={styles.detailCopy}>
          <Link href="/examples">All examples</Link>
          <h1>{example.name}</h1>
          <span className={styles.sampleTag}>Demo · fictional content</span>
          <p>{example.role}</p>
          <p>
            This is an illustrative career, with fictional employers, dates and
            outcomes. The example is view-only and is never saved to your
            personal library by browsing.
          </p>
          <Link
            href={`/builder?example=${example.id}`}
            className={styles.button}
          >
            Use this design with my details
          </Link>
          <h2>Borrow the structure</h2>
          <p>
            Notice the order of sections, the balance of context and
            achievements, and how dates stay attached to each role. Starting
            from this example copies only presentation, leaving career facts
            empty.
          </p>
          <h2>Synthetic job brief</h2>
          <p>{learning.job}</p>
          <h2>Annotated rewrite</h2>
          <p><strong>Vague draft:</strong> {learning.before}</p>
          <p><strong>With supplied evidence:</strong> {learning.after}</p>
          <p>This wording uses the fictional entry “{learning.evidence}”. Its
            details and any metrics belong only to this sample. Use your own
            evidence before applying this pattern.</p>
          <h2>Write what you can support</h2>
          <p>
            Describe your own contribution. Add numbers only when you have
            evidence; a useful qualitative outcome is better than an invented
            metric.
          </p>
        </div>
        <PublicResume doc={example.create()} />
      </div>
    </PublicShell>
  );
}
