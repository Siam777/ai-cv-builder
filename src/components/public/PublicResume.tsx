"use client";

import { useState } from "react";
import Link from "next/link";
import type { ResumeDocument } from "@/lib/document";
import { layoutBlocks } from "@/lib/layout";
import { pageMetrics } from "@/lib/presentation";
import {
  ResumePreview,
  ResumeBlock,
  presentationClass,
  presentationStyle,
} from "@/components/resume-preview";
import styles from "./public-site.module.css";

export function ResumeThumbnail({
  doc,
  scale = 0.32,
}: {
  doc: ResumeDocument;
  scale?: number;
}) {
  const paper = pageMetrics(doc.presentation);
  return (
    <div
      className={styles.thumbnail}
      aria-hidden="true"
      inert
      style={{
        width: ((paper.width * 96) / 25.4) * scale,
        height: ((paper.height * 96) / 25.4) * scale,
      }}
    >
      <div
        className={`${styles.thumbnailPaper} page-sheet ${presentationClass(doc.presentation)}`}
        style={{
          ...presentationStyle(doc.presentation),
          transform: `scale(${scale})`,
        }}
      >
        <div className="page-content">
          {layoutBlocks(doc).map((block) => (
            <ResumeBlock key={block.id} block={{ ...block, href: undefined }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicResume({ doc }: { doc: ResumeDocument }) {
  return (
    <div className={styles.detailPreview}>
      <ResumePreview doc={doc} />
    </div>
  );
}

export function ResumeShowcase({ sample }: { sample: ResumeDocument }) {
  const [template, setTemplate] = useState<"classic" | "modern" | "creative">(
    "classic",
  );
  // A style change is confined to this example. No repository or account calls.
  const [base] = useState(sample);
  const doc = { ...base, presentation: { ...base.presentation, template } };
  return (
    <section
      className={styles.showcase}
      aria-label="Explore a fictional resume design"
    >
      <div className={styles.showcaseTop}>
        <span>Fictional example · Alex Morgan</span>
        <span>Live preview</span>
      </div>
      <div
        className={styles.styleChoices}
        role="group"
        aria-label="Example design"
      >
        {(["classic", "modern", "creative"] as const).map((id) => (
          <button
            type="button"
            key={id}
            aria-pressed={template === id}
            onClick={() => setTemplate(id)}
          >
            {id.charAt(0).toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>
      <div className={styles.heroPaper} aria-hidden="true" inert>
        <ResumePreview doc={doc} />
      </div>
      <div className={styles.showcaseBottom}>
        <p>Same experience. A different presentation.</p>
        <Link href={`/templates/${template}`}>Inspect this design</Link>
      </div>
    </section>
  );
}
