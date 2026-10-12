import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";
import { PublicGallery } from "@/components/public/PublicGallery";
import { publicDesigns, designSample } from "@/lib/public-catalog";
import styles from "@/components/public/public-site.module.css";
import { DesignComparison } from "@/components/public/DesignSamples";
export const metadata: Metadata = {
  title: "Resume templates · AI CV Builder",
  description:
    "Inspect twelve current resume designs with the same fictional content. Choose presentation without copying career facts.",
};
export default function Templates() {
  return (
    <PublicShell active="/templates">
      <div className={styles.pageIntro}>
        <h1>Find your way onto the page.</h1>
        <p>
          Compare twelve current designs using the same fictional resume. Open a
          design for the full paginated preview, then start with your own
          details.
        </p>
        <p>
          All current styles are available for device editing. Downloads require
          sign-in and verified email.
        </p>
      </div>
      <DesignComparison />
      <PublicGallery
        items={publicDesigns.map((item) => ({
          ...item,
          category: item.family,
          doc: designSample(item.id),
        }))}
      />
    </PublicShell>
  );
}
