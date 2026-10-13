"use client";

import { useRef, useState } from "react";
import type { ResumeDocument } from "@/lib/document";
import { parseBackup } from "@/lib/document";
import { parseTextToResume } from "@/lib/importers/text-resume-parser";
import {
  parseLinkedInArchive,
  isLinkedInCsv,
} from "@/lib/importers/linkedin-importer";
import { FileText, FolderOpen } from "lucide-react";

export interface ColdStartImporterProps {
  disabled?: boolean;
  onStaged: (staged: {
    document: ResumeDocument;
    warnings: string[];
    sourceFile: string;
  }) => void;
  onError: (error: string) => void;
  onOpenAiGenerator?: () => void;
  onOpenDemoGallery?: () => void;
}

export function ColdStartImporter({
  disabled = false,
  onStaged,
  onError,
  onOpenAiGenerator,
  onOpenDemoGallery,
}: ColdStartImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file?: File) {
    if (!file) return;
    if (file.size > 5_000_000) {
      onError("File exceeds the 5 MB size limit.");
      return;
    }

    setIsProcessing(true);
    onError("");

    try {
      const fileName = file.name.toLowerCase();

      // If JSON backup file
      if (fileName.endsWith(".json")) {
        const text = await file.text();
        const doc = parseBackup(text);
        onStaged({
          document: doc,
          warnings: [],
          sourceFile: file.name,
        });
        return;
      }

      // PDF and DOCX parsing runs on the application server.
      if (fileName.endsWith(".pdf") || fileName.endsWith(".docx")) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/resumes/import-file", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to parse resume file.");
        }

        onStaged({
          document: data.document,
          warnings: data.warnings || [],
          sourceFile: file.name,
        });
        return;
      }

      // If CSV file (e.g. LinkedIn archive Positions.csv or Skills.csv)
      if (fileName.endsWith(".csv")) {
        const text = await file.text();
        if (isLinkedInCsv(text)) {
          const linkedInRes = parseLinkedInArchive(
            { [file.name]: text },
            file.name.replace(/\.csv$/i, ""),
          );
          onStaged({
            document: linkedInRes.document,
            warnings: linkedInRes.warnings,
            sourceFile: file.name,
          });
          return;
        }
      }

      // Plain text or markdown
      const text = await file.text();
      const result = parseTextToResume(text, file.name);
      onStaged({
        document: result.document,
        warnings: result.warnings,
        sourceFile: file.name,
      });
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div
      className={`cold-start-dropzone ${isDragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !isProcessing) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled || isProcessing) return;
        const file = e.dataTransfer.files?.[0];
        void handleFile(file);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.json,.csv,application/pdf,text/plain,application/json,text/csv"
        hidden
        aria-label="Upload existing resume"
        disabled={disabled || isProcessing}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="dropzone-content">
        <FileText className="dropzone-icon" size={32} aria-hidden />
        <div className="dropzone-text">
          <strong>
            {isProcessing
              ? "Analyzing and extracting resume…"
              : "Drop your existing resume here"}
          </strong>
          <p>
            Supports PDF, DOCX, plain text, Markdown, or JSON backup (up to 5
            MB)
          </p>
          <p>
            PDF and DOCX files are sent to this app’s server for extraction.
            Review the parsed fields before saving; scanned PDFs require
            selectable text.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            marginTop: "12px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            className="dropzone-browse-button"
            disabled={disabled || isProcessing}
            onClick={() => fileInputRef.current?.click()}
          >
            {isProcessing ? "Processing…" : "Browse file"}
          </button>
          {onOpenDemoGallery && (
            <button
              type="button"
              className="dropzone-browse-button"
              style={{
                background: "var(--color-info-soft)",
                color: "var(--color-info)",
                borderColor: "var(--blue-100)",
              }}
              disabled={disabled || isProcessing}
              onClick={onOpenDemoGallery}
            >
              <FolderOpen size={16} aria-hidden /> Explore Demo CVs
            </button>
          )}
          {onOpenAiGenerator && (
            <button
              type="button"
              className="dropzone-browse-button"
              style={{
                background: "var(--color-brand-soft)",
                color: "var(--color-brand)",
                borderColor: "var(--green-200)",
              }}
              disabled={disabled || isProcessing}
              onClick={onOpenAiGenerator}
            >
              Create practice example
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
