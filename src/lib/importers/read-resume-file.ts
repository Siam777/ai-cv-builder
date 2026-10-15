import { parseBackup, type ResumeDocument } from "@/lib/document";
import { parseTextToResume } from "./text-resume-parser";
import { isLinkedInCsv, parseLinkedInArchive } from "./linkedin-importer";

/** A parsed file waiting for the user's review before it is saved. */
export interface StagedImport {
  document: ResumeDocument;
  warnings: string[];
  sourceFile: string;
}

const MAX_BYTES = 5_000_000;

/**
 * Reads an existing CV file. PDF and DOCX are extracted on this app's server;
 * JSON backups, LinkedIn CSVs, plain text and Markdown are parsed in the browser.
 */
export async function readResumeFile(file: File): Promise<StagedImport> {
  if (file.size > MAX_BYTES) throw new Error("File exceeds the 5 MB size limit.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".json"))
    return { document: parseBackup(await file.text()), warnings: [], sourceFile: file.name };
  if (name.endsWith(".pdf") || name.endsWith(".docx")) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/resumes/import-file", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.success)
      throw new Error(data.error || "Failed to parse resume file.");
    return { document: data.document, warnings: data.warnings || [], sourceFile: file.name };
  }
  const text = await file.text();
  if (name.endsWith(".csv") && isLinkedInCsv(text)) {
    const parsed = parseLinkedInArchive({ [file.name]: text }, file.name.replace(/\.csv$/i, ""));
    return { document: parsed.document, warnings: parsed.warnings, sourceFile: file.name };
  }
  const parsed = parseTextToResume(text, file.name);
  return { document: parsed.document, warnings: parsed.warnings, sourceFile: file.name };
}

/**
 * Reads the CSV files from a LinkedIn data export (Profile, Positions, Education,
 * Skills, Certifications). Files that are not LinkedIn CSVs are rejected.
 */
export async function readLinkedInFiles(files: File[]): Promise<StagedImport> {
  if (!files.length) throw new Error("Choose at least one CSV file from your LinkedIn export.");
  if (files.reduce((total, file) => total + file.size, 0) > MAX_BYTES)
    throw new Error("These files exceed the 5 MB size limit.");
  const contents: Record<string, string> = {};
  for (const file of files) {
    const text = await file.text();
    if (!file.name.toLowerCase().endsWith(".csv") || !isLinkedInCsv(text))
      throw new Error(`${file.name} is not a LinkedIn export CSV. Choose Profile.csv, Positions.csv, Education.csv or Skills.csv.`);
    contents[file.name] = text;
  }
  const parsed = parseLinkedInArchive(contents);
  return {
    document: parsed.document,
    warnings: parsed.warnings,
    sourceFile: files.map((file) => file.name).join(", "),
  };
}
