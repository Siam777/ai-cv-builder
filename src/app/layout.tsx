import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./templates.css";
import "./resume-fonts.css";
import "./library.css";
import "./editor-polish.css";
import "./usability.css";
import "./score.css";

const interfaceFont = localFont({
  src: "./fonts/SourceSans3-Upright.woff2",
  weight: "200 900",
  display: "swap",
  variable: "--font-interface",
});
const displayFont = localFont({
  src: "./fonts/SourceSerif4-Regular.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "AI CV Builder · Resume studio",
  description:
    "Create and organize your personal CVs, explore separate demo examples, and sign in to export.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${interfaceFont.variable} ${displayFont.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
