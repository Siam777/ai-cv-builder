import { z } from "zod";

export const templates = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional typography. A familiar, confident introduction.",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Clean lines, a strong headline, and a restrained accent.",
  },
  {
    id: "compact",
    name: "Compact",
    description: "An efficient layout with room for more experience.",
  },
  {
    id: "creative",
    name: "Creative",
    description: "An editorial layout with an optional colored side rail.",
  },
] as const;
export const accents = {
  forest: "#285641",
  navy: "#234b73",
  plum: "#703b61",
  rust: "#8a452e",
  charcoal: "#343d42",
};
export const fonts = {
  sans: { name: "Arial", family: "Arial, Helvetica, sans-serif" },
  serif: { name: "Georgia", family: "Georgia, 'Times New Roman', serif" },
  humanist: { name: "Verdana", family: "Verdana, Geneva, sans-serif" },
};
export const densities = {
  airy: { name: "Airy", lineHeight: 1.6, gap: 13, margin: 19 },
  balanced: { name: "Balanced", lineHeight: 1.45, gap: 10, margin: 16 },
  compact: { name: "Compact", lineHeight: 1.3, gap: 7, margin: 14 },
  tight: { name: "Tight", lineHeight: 1.2, gap: 5, margin: 12 },
};
// Additive defaults keep Phase 1 version-1 documents readable without rewriting their facts.
export const presentationSchema = z.strictObject({
  template: z.enum(["classic", "modern", "compact", "creative"]),
  pageSize: z.enum(["A4", "Letter"]),
  accent: z
    .enum(["forest", "navy", "plum", "rust", "charcoal"])
    .default("forest"),
  font: z.enum(["sans", "serif", "humanist"]).default("sans"),
  fontSize: z.union([z.literal(10), z.literal(11), z.literal(12)]).default(10),
  density: z.enum(["airy", "balanced", "compact", "tight"]).default("balanced"),
  sidebar: z.boolean().default(true),
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
