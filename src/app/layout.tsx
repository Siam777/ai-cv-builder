import type { Metadata } from "next";
import "./globals.css";
import "./templates.css";

export const metadata: Metadata = {
  title: "AI CV Builder · Resume studio",
  description:
    "A thoughtful workspace for your next chapter. Create, edit, and export your resume locally.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
