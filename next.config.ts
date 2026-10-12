import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "yauzl",
    "fast-xml-parser",
  ],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Local databases, email test outboxes and review artifacts are never runtime assets.
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./test-results/**/*"],
  },
  outputFileTracingIncludes: {
    "/api/diagnostics/file": [
      "./src/lib/server/pdf-diagnostic-process.mjs",
      "./node_modules/pdfjs-dist/legacy/build/*.mjs",
      "./node_modules/@napi-rs/canvas*/**/*",
    ],
    "/api/resumes/import-file": [
      "./src/lib/server/pdf-diagnostic-process.mjs",
      "./node_modules/pdfjs-dist/legacy/build/*.mjs",
      "./node_modules/@napi-rs/canvas*/**/*",
    ],
    "/api/exports": [
      "./src/app/templates.css",
      "./src/app/resume-fonts.css",
      "./src/app/fonts/*",
    ],
    "/api/resumes/export-pdf": [
      "./src/app/templates.css",
      "./src/app/resume-fonts.css",
      "./src/app/fonts/*",
    ],
  },
};
export default config;
