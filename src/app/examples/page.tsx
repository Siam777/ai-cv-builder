import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicGallery } from "@/components/public/PublicGallery";
import { DEMO_PROFILES } from "@/lib/demo-resumes";
import styles from "@/components/public/public-site.module.css";
export const metadata: Metadata = {
  title: "Fictional resume examples · AI CV Builder",
};
export default function Examples() {
  return (
    <PublicShell active="/examples">
      <div className={styles.pageIntro}>
        <h1>See how a career can read.</h1>
        <p>
          Twelve fictional examples for exploring structure and presentation.
          These names, employers and achievements are sample content. Browsing
          never adds a CV to your library.
        </p>
        <p>
          Use an example's design with your own details. Do not copy its career
          claims.
        </p>
      </div>
      <PublicGallery
        examples
        items={DEMO_PROFILES.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.role,
          category:
            item.category.charAt(0).toUpperCase() + item.category.slice(1),
          doc: item.create(),
        }))}
      />
    </PublicShell>
  );
}
