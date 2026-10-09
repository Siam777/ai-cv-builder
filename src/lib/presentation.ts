import { z } from "zod";

export const templates = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional typography with clean linear reading order for maximum parsing reliability.",
    tagline: "ATS-Safe & Timeless",
    badge: "Traditional · 1 Column",
    category: "ats",
    atsRating: "100%",
    photoSupported: false,
  },
  {
    id: "modern",
    name: "Modern",
    description: "Clean sans-serif structure, subtle accent header bars, and refined section borders.",
    tagline: "Polished Tech & Corporate",
    badge: "Contemporary · Clean Header",
    category: "modern",
    atsRating: "98%",
    photoSupported: true,
  },
  {
    id: "compact",
    name: "Compact",
    description: "Condensed spacing with bounded line heights, built to fit dense career achievements on fewer pages.",
    tagline: "Maximum Content per Page",
    badge: "High Density · Space Saver",
    category: "ats",
    atsRating: "99%",
    photoSupported: false,
  },
  {
    id: "creative",
    name: "Creative",
    description: "Two-column editorial hierarchy with an optional colored side rail for skills and credentials.",
    tagline: "Distinguished Sidebar Layout",
    badge: "Editorial · Two-Column",
    category: "creative",
    atsRating: "96%",
    photoSupported: true,
  },
  {
    id: "tech",
    name: "Tech Startup",
    description: "Developer-centric layout with dark tech skill pills, GitHub/portfolio links, and clean project blocks.",
    tagline: "Developer & Startup Ready",
    badge: "Clean · Tech Stack Focus",
    category: "modern",
    atsRating: "98%",
    photoSupported: false,
  },
  {
    id: "executive",
    name: "Executive Luxury",
    description: "Prestigious serif typography with subtle gold/slate/burgundy accents for senior leadership roles.",
    tagline: "Leadership & Senior Roles",
    badge: "Prestigious · Executive",
    category: "executive",
    atsRating: "99%",
    photoSupported: false,
  },
  {
    id: "timeline",
    name: "Timeline Modern",
    description: "Visual career milestone connectors with dates, circular nodes, and modern pill badges.",
    tagline: "Career Progression Visualized",
    badge: "Milestones · Timeline Rail",
    category: "modern",
    atsRating: "97%",
    photoSupported: true,
  },
  {
    id: "minimalist",
    name: "Minimalist Simple",
    description: "Canva Simple-inspired Swiss design with generous white space and understated typography.",
    tagline: "Ultra-Clean & Elegant",
    badge: "Canva Style · Minimalist",
    category: "creative",
    atsRating: "99%",
    photoSupported: true,
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
  sans: { name: "Arial", family: "Arial, 'Segoe UI', Tahoma, Helvetica, sans-serif" },
  serif: { name: "Georgia", family: "Georgia, 'Times New Roman', 'Traditional Arabic', serif" },
  humanist: { name: "Verdana", family: "Verdana, Geneva, Tahoma, sans-serif" },
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
