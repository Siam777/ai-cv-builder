"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  FilePlus2,
  FileUp,
  Contact,
  ListChecks,
} from "lucide-react";
import {
  readLinkedInFiles,
  readResumeFile,
  type StagedImport,
} from "@/lib/importers/read-resume-file";

export interface StartScreenProps {
  disabled: boolean;
  signedIn: boolean;
  /** The design picked on /templates before starting, if any. */
  startingDesign?: string;
  onClearStartingDesign: () => void;
  onStaged: (staged: StagedImport) => void;
  onError: (message: string) => void;
  onScratch: () => void;
  onGuided: () => void;
  onExamples: () => void;
  onPractice: () => void;
  onRestoreBackup: () => void;
  /** Shown when the user already has CVs to go back to. */
  onBack?: () => void;
}

/** The one place to start a new CV: upload, LinkedIn, blank or guided. */
export function StartScreen({
  disabled,
  signedIn,
  startingDesign,
  onClearStartingDesign,
  onStaged,
  onError,
  onScratch,
  onGuided,
  onExamples,
  onPractice,
  onRestoreBackup,
  onBack,
}: StartScreenProps) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const linkedInInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<"upload" | "linkedin" | null>(null);
  const [dragging, setDragging] = useState(false);
  const locked = disabled || !!reading;

  async function read(kind: "upload" | "linkedin", work: () => Promise<StagedImport>) {
    setReading(kind);
    onError("");
    try {
      onStaged(await work());
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setReading(null);
    }
  }

  return (
    <main id="workspace-main" tabIndex={-1} className="start-screen no-print">
      {onBack && (
        <button type="button" className="start-back" disabled={locked} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden /> Back to My CVs
        </button>
      )}
      <header className="start-heading">
        <h2>How would you like to start?</h2>
        <p>
          {signedIn
            ? "Your new CV is saved to your account."
            : "Your new CV is saved in this browser. Sign in any time to back it up."}
        </p>
      </header>
      {startingDesign && (
        <section className="starting-design" aria-label="Selected starting design">
          <div>
            <strong>Start with {startingDesign}</strong>
            <p>Your new CV will use this design. Your details start empty.</p>
          </div>
          <button type="button" disabled={locked} onClick={onClearStartingDesign}>
            Clear design choice
          </button>
        </section>
      )}
      <div className="start-choices">
        <div
          className={`start-choice start-upload${dragging ? " dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!locked) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (!locked && file) void read("upload", () => readResumeFile(file));
          }}
        >
          <FileUp className="start-choice-icon" size={28} aria-hidden />
          <h3>Upload my CV</h3>
          <p>PDF, Word (DOCX), text or Markdown, up to 5 MB. You can also drop the file here.</p>
          <button
            type="button"
            className="primary"
            disabled={locked}
            onClick={() => uploadInput.current?.click()}
          >
            {reading === "upload" ? "Reading your CV…" : "Upload my CV"}
          </button>
          <p className="start-choice-note">
            PDF and Word files are read on this app&apos;s server. You check every field before
            anything is saved. Scanned PDFs need selectable text.
          </p>
          <input
            ref={uploadInput}
            type="file"
            hidden
            accept=".pdf,.docx,.txt,.md,.json,.csv,application/pdf,text/plain,application/json,text/csv"
            aria-label="Upload existing resume"
            disabled={locked}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void read("upload", () => readResumeFile(file));
            }}
          />
        </div>
        <div className="start-choice">
          <Contact className="start-choice-icon" size={28} aria-hidden />
          <h3>Import from LinkedIn</h3>
          <p>
            Use the CSV files from your LinkedIn data export: Profile, Positions, Education and
            Skills. You can pick several at once.
          </p>
          <button type="button" disabled={locked} onClick={() => linkedInInput.current?.click()}>
            {reading === "linkedin" ? "Reading your files…" : "Import from LinkedIn"}
          </button>
          <p className="start-choice-note">
            On LinkedIn: Settings, Data privacy, Get a copy of your data. Unzip the download, then
            choose its CSV files here.
          </p>
          <input
            ref={linkedInInput}
            type="file"
            hidden
            multiple
            accept=".csv,text/csv"
            aria-label="LinkedIn export CSV files"
            disabled={locked}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length) void read("linkedin", () => readLinkedInFiles(files));
            }}
          />
        </div>
        <div className="start-choice">
          <FilePlus2 className="start-choice-icon" size={28} aria-hidden />
          <h3>Start from scratch</h3>
          <p>A blank CV with the usual sections. The steps on the left guide you through it.</p>
          <button type="button" disabled={locked} onClick={onScratch}>
            Start from scratch
          </button>
        </div>
        <div className="start-choice">
          <ListChecks className="start-choice-icon" size={28} aria-hidden />
          <h3>Start from my job title</h3>
          <p>
            Answer a few questions: your name, job title and a few things you did. We set up your
            CV from your answers. Nothing is made up.
          </p>
          <button type="button" disabled={locked} onClick={onGuided}>
            Start from my job title
          </button>
        </div>
      </div>
      <section className="start-examples" aria-labelledby="start-examples-heading">
        <h3 id="start-examples-heading">Or try an example</h3>
        <p>Examples use fictional people. They stay separate from your own CVs.</p>
        <div className="button-row">
          <button type="button" disabled={locked} onClick={onExamples}>
            Browse example CVs
          </button>
          <button type="button" disabled={locked} onClick={onPractice}>
            Create a practice CV
          </button>
          <button type="button" disabled={locked} onClick={onRestoreBackup}>
            Restore a backup (.json)
          </button>
        </div>
      </section>
    </main>
  );
}
