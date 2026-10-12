"use client";
import { useMemo, useState } from "react";
import { designSample, publicDesigns } from "@/lib/public-catalog";
import type { Presentation } from "@/lib/presentation";
import { letterDocument } from "@/lib/letter-layout";
import { PublicResume } from "./PublicResume";
import styles from "./public-site.module.css";

export function DesignSamples({
  template,
}: {
  template: Presentation["template"];
}) {
  const [sample, setSample] = useState("short");
  const doc = useMemo(() => {
    const resume = designSample(template, sample === "long" ? "long" : "short");
    return sample === "letter"
      ? letterDocument(
          resume,
          "Fictional letter example\n\nDear hiring team,\n\nI am interested in the product design role described in this synthetic example. My fictional experience includes reviewing workflows with colleagues and sharing design decisions with a product team.\n\nI would welcome a conversation about how that experience relates to your team’s work.\n\nKind regards,\nAlex Morgan",
        )
      : resume;
  }, [template, sample]);
  return (
    <section className={styles.samplePanel} aria-label="Design samples">
      <div
        className={styles.filters}
        role="group"
        aria-label="Sample length and letterhead"
      >
        {[
          ["short", "Short resume"],
          ["long", "Long resume"],
          ["letter", "Matching letterhead"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={sample === id}
            onClick={() => setSample(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p>
        Fictional content. Letter printing uses the CV’s design, fonts and paper
        settings.
      </p>
      <PublicResume doc={doc} />
    </section>
  );
}

export function DesignComparison() {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState<Presentation["template"]>("classic");
  const [right, setRight] = useState<Presentation["template"]>("modern");
  return (
    <section className={styles.comparison} aria-label="Compare resume designs">
      <button
        type="button"
        className={styles.secondaryButton}
        aria-expanded={open}
        aria-controls="design-comparison"
        onClick={() => setOpen(!open)}
      >
        Compare two designs
      </button>
      {open && (
        <div id="design-comparison">
          <p>
            The same fictional content in two complete, paginated previews.
            Selection does not create a CV.
          </p>
          <div className={styles.comparisonGrid}>
            {(
              [
                ["First design", left, setLeft],
                ["Second design", right, setRight],
              ] as const
            ).map(([label, value, setValue]) => (
              <div key={label}>
                <label className={styles.selectLabel}>
                  {label}
                  <select
                    value={value}
                    onChange={(event) =>
                      setValue(event.target.value as Presentation["template"])
                    }
                  >
                    {publicDesigns.map((design) => (
                      <option key={design.id} value={design.id}>
                        {design.name}
                      </option>
                    ))}
                  </select>
                </label>
                <PublicResume doc={designSample(value)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
