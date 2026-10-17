import { z } from "zod";

export const templates = [
  {
    id: "classic",
    name: "Classic",
    description:
      "Traditional typography with a conventional single-column layout.",
    tagline: "Simple & Timeless",
    badge: "Traditional · 1 Column",
    category: "ats",
    photoSupported: false,
    columns: 1,
  },
  {
    id: "modern",
    name: "Modern",
    description:
      "Clean sans-serif structure, subtle accent header bars, and refined section borders.",
    tagline: "Polished Tech & Corporate",
    badge: "Contemporary · Clean Header",
    category: "modern",
    photoSupported: true,
    columns: 1,
  },
  {
    id: "compact",
    name: "Compact",
    description:
      "Condensed spacing with bounded line heights, built to fit dense career achievements on fewer pages.",
    tagline: "Maximum Content per Page",
    badge: "High Density · Space Saver",
    category: "ats",
    photoSupported: false,
    columns: 1,
  },
  {
    id: "creative",
    name: "Creative",
    description:
      "An optional contact sidebar beside a clear, sequential career column.",
    tagline: "Editorial Contact Sidebar",
    badge: "Editorial · Contact Sidebar",
    category: "creative",
    photoSupported: true,
    columns: 2,
  },
  {
    id: "tech",
    name: "Tech Startup",
    description:
      "Technical typography with clear project blocks and clickable portfolio contact links.",
    tagline: "Developer & Startup Ready",
    badge: "Clean · Tech Stack Focus",
    category: "modern",
    photoSupported: false,
    columns: 1,
  },
  {
    id: "executive",
    name: "Executive Luxury",
    description:
      "Serif typography and restrained accent rules for senior leadership roles.",
    tagline: "Leadership & Senior Roles",
    badge: "Prestigious · Executive",
    category: "executive",
    photoSupported: true,
    columns: 1,
  },
  {
    id: "timeline",
    name: "Timeline Modern",
    description:
      "A career connector with aligned date cells beside each role’s organization details.",
    tagline: "Career Progression Visualized",
    badge: "Milestones · Timeline Rail",
    category: "modern",
    photoSupported: true,
    columns: 1,
  },
  {
    id: "minimalist",
    name: "Minimalist Simple",
    description:
      "Original minimalist design with generous white space and understated typography.",
    tagline: "Ultra-Clean & Elegant",
    badge: "Quiet · Minimalist",
    category: "creative",
    photoSupported: true,
    columns: 1,
  },
  {
    id: "elegant",
    name: "Consulting",
    description:
      "A centered serif nameplate, restrained rules and clear achievement headings.",
    tagline: "Finance & Consulting",
    badge: "Refined · Single Column",
    category: "executive",
    photoSupported: true,
    columns: 1,
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description:
      "Light section panels and a distinct selected-work hierarchy, with your section order preserved.",
    tagline: "Selected Work & Case Studies",
    badge: "Creative · Section Panels",
    category: "creative",
    photoSupported: true,
    columns: 1,
  },
  {
    id: "bold",
    name: "Brand",
    description:
      "An expressive accent nameplate balanced by a disciplined single-column body.",
    tagline: "Sales & Marketing",
    badge: "Expressive · Clear Structure",
    category: "modern",
    photoSupported: true,
    columns: 1,
  },
  {
    id: "academic",
    name: "Research",
    description:
      "Serif headings and restrained spacing for education, publications and longer research CVs.",
    tagline: "Research & Education",
    badge: "Scholarly · Long CV",
    category: "ats",
    photoSupported: false,
    columns: 1,
  },
] as const;
export const accents = {
  forest: "#285641",
  navy: "#234b73",
  plum: "#703b61",
  rust: "#8a452e",
  charcoal: "#343d42",
  indigo: "#3730a3",
  slate: "#334155",
};
export const fonts = {
  sans: { name: "Source Sans 3", family: "'Source Sans 3', sans-serif" },
  serif: { name: "Source Serif 4", family: "'Source Serif 4', serif" },
  humanist: { name: "Lato", family: "Lato, sans-serif" },
};
export const densities = {
  airy: { name: "Airy", lineHeight: 1.6, gap: 13, margin: 19 },
  balanced: { name: "Balanced", lineHeight: 1.45, gap: 10, margin: 16 },
  compact: { name: "Compact", lineHeight: 1.3, gap: 7, margin: 14 },
  tight: { name: "Tight", lineHeight: 1.2, gap: 5, margin: 12 },
};
// Additive defaults keep Phase 1 version-1 documents readable without rewriting their facts.
export const presentationSchema = z.strictObject({
  template: z.enum([
    "classic",
    "modern",
    "compact",
    "creative",
    "tech",
    "executive",
    "timeline",
    "minimalist",
    "elegant",
    "portfolio",
    "bold",
    "academic",
  ]),
  pageSize: z.enum(["A4", "Letter"]),
  accent: z
    .enum(["forest", "navy", "plum", "rust", "charcoal", "indigo", "slate"])
    .default("forest"),
  font: z.enum(["sans", "serif", "humanist"]).default("sans"),
  fontSize: z.union([z.literal(10), z.literal(11), z.literal(12)]).default(10),
  density: z.enum(["airy", "balanced", "compact", "tight"]).default("balanced"),
  sidebar: z.boolean().default(true),
  direction: z.enum(["ltr", "rtl"]).default("ltr"),
  showPhoto: z.boolean().default(true),
});
export type Presentation = z.infer<typeof presentationSchema>;
export function pageMetrics(p: Presentation) {
  const density = densities[p.density];
  return {
    width: p.pageSize === "A4" ? 210 : 215.9,
    height: p.pageSize === "A4" ? 297 : 279.4,
    margin: density.margin,
  };
}
