import type { Metadata } from "next";
import { ApplicationsApp } from "@/components/applications/ApplicationsApp";

export const metadata: Metadata = {
  title: "Applications · AI CV Builder",
  robots: { index: false, follow: false },
};
export default function ApplicationsPage() {
  return <ApplicationsApp />;
}
