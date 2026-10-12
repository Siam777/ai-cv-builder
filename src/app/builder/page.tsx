import type { Metadata } from "next";
import { ResumeStudio } from "@/components/resume-studio";
import { resolveStartingDesign } from "@/lib/public-catalog";

export const metadata: Metadata = {
  title: "CV library & editor · AI CV Builder",
  robots: { index: false, follow: false },
};
export default async function Builder({
  searchParams,
}: {
  searchParams: Promise<{
    template?: string | string[];
    example?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const design = resolveStartingDesign(
    typeof query.template === "string" ? query.template : undefined,
    typeof query.example === "string" ? query.example : undefined,
  );
  return <ResumeStudio startingDesign={design} />;
}
