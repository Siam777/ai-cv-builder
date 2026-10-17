"use client";

import { useState } from "react";
import type { ResumeDocument } from "@/lib/document";
import Link from "next/link";
import { Plus } from "lucide-react";
import { LibraryResumeCard } from "./LibraryResumeCard";
import {
  documentsInCollection,
  type LibraryCollection,
} from "@/lib/document-library";

export function DocumentLibrary({
  documents,
  accountEmail,
  busy,
  onOpen,
  onDuplicate,
  onDelete,
  onClassify,
  onNew,
}: {
  documents: ResumeDocument[];
  accountEmail?: string;
  busy: boolean;
  onOpen: (doc: ResumeDocument) => void;
  onDuplicate: (doc: ResumeDocument) => void;
  onDelete: (doc: ResumeDocument) => void;
  onClassify: (doc: ResumeDocument, purpose: "personal" | "practice") => void;
  /** Opens the start screen (upload, LinkedIn, blank, guided or example). */
  onNew: () => void;
}) {
  const [collection, setCollection] = useState<LibraryCollection>("personal");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const labels = {
    personal: accountEmail ? "My CVs" : "On this device",
    practice: "Practice copies",
    unclassified: "Review older drafts",
  };
  const emptyLabels = {
    personal: accountEmail
      ? "No personal CVs yet"
      : "No CVs on this device yet",
    practice: "No practice copies yet",
    unclassified: "No older drafts to review",
  };
  const resultLocation =
    collection === "personal"
      ? accountEmail
        ? "in your account"
        : "on this device"
      : collection === "practice"
        ? "in practice copies"
        : "in older drafts";
  const visible = documentsInCollection(documents, collection)
    .filter((doc) =>
      `${doc.name} ${doc.contact.name} ${doc.contact.headline}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
        : b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
    );
  return (
    <main
      id="workspace-main"
      tabIndex={-1}
      className="document-library no-print"
      aria-label="CV library"
    >
      <div className="library-heading">
        <p>
          {accountEmail
            ? `Your own CVs are saved to ${accountEmail}. Practice copies and older drafts have their own tabs.`
            : "These CVs belong to this browser profile. Sign in to keep them in an account."}
        </p>
        <div className="button-row">
          <button className="primary" disabled={busy} onClick={onNew}>
            <Plus size={16} aria-hidden /> New CV
          </button>
        </div>
      </div>
      <nav className="library-tabs" aria-label="Document collections">
        {(["personal", "practice", "unclassified"] as const).map((key) => (
          <button
            key={key}
            aria-pressed={collection === key}
            disabled={busy}
            onClick={() => setCollection(key)}
          >
            {labels[key]}{" "}
            <span>{documentsInCollection(documents, key).length}</span>
          </button>
        ))}
      </nav>
      <div className="library-tools">
        <label className="library-search">
          Search {labels[collection].toLowerCase()}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="CV title, name, or role"
          />
        </label>
        <label className="library-sort">
          Sort CVs
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="recent">Recently updated</option>
            <option value="name">CV title</option>
          </select>
        </label>
      </div>
      <p className="library-result-count" role="status">
        {visible.length} {visible.length === 1 ? "CV" : "CVs"} {resultLocation}
      </p>
      {collection === "unclassified" && (
        <p className="library-explanation">
          Older drafts do not record whether they are personal or examples.
          Review them before choosing. All your content has been kept.
        </p>
      )}
      {collection === "practice" && (
        <p className="library-explanation">
          Practice copies may contain fictional details. They stay separate from
          your personal CVs.
        </p>
      )}
      {!visible.length && (
        <div className="library-empty">
          <h3>{query ? "No matching CVs" : emptyLabels[collection]}</h3>
          <p>
            {query
              ? "Try another name or role."
              : collection === "personal"
                ? "Start with your own details, import a CV, or explore a design without copying someone else's experience."
                : "Documents in this collection will appear here."}
          </p>
          {query ? (
            <button onClick={() => setQuery("")}>Clear search</button>
          ) : collection === "personal" ? (
            <div className="library-first-steps">
              <p>
                <strong>Start a CV</strong>
                <br />
                Choose New CV to upload your current CV, import from LinkedIn
                or start from scratch.
              </p>
              <p>
                <strong>Choose a presentation</strong>
                <br />
                <Link href="/templates">Browse all twelve designs</Link>.
                Picking a design leaves personal facts empty.
              </p>
            </div>
          ) : null}
        </div>
      )}
      <div className="library-grid">
        {visible.map((doc) => (
          <LibraryResumeCard
            key={doc.id}
            doc={doc}
            accountEmail={accountEmail}
            busy={busy}
            onOpen={onOpen}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onClassify={onClassify}
          />
        ))}
      </div>
      <p className="library-explanation">
        Example CVs live in their own gallery. Browsing them never adds a CV
        here.
      </p>
    </main>
  );
}
