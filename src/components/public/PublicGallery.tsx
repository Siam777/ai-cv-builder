"use client";

import { useState } from "react";
import Link from "next/link";
import type { ResumeDocument } from "@/lib/document";
import { ResumeThumbnail } from "./PublicResume";
import styles from "./public-site.module.css";
import { designSample } from "@/lib/public-catalog";

export interface GalleryItem {
  id: string;
  name: string;
  description: string;
  category: string;
  columns?: string;
  stages?: string[];
  formats?: string[];
  doc: ResumeDocument;
}
export function PublicGallery({
  items,
  examples = false,
}: {
  items: GalleryItem[];
  examples?: boolean;
}) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [columns, setColumns] = useState("All");
  const [stage, setStage] = useState("All");
  const [length, setLength] = useState("short");
  const [format, setFormat] = useState("All");
  const categories = ["All", ...new Set(items.map((item) => item.category))];
  const filtered = items.filter(
    (item) =>
      (filter === "All" || item.category === filter) &&
      (columns === "All" || item.columns === columns) &&
      (stage === "All" || item.stages?.includes(stage)) &&
      (format === "All" || item.formats?.includes(format)) &&
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const route = examples ? "examples" : "templates";
  return (
    <>
      <div className={styles.galleryTools}>
        <div
          className={styles.filters}
          role="group"
          aria-label={examples ? "Example categories" : "Design categories"}
        >
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              aria-pressed={filter === category}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <label className={styles.search}>
          Search {examples ? "examples" : "designs"}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={examples ? "Name or role" : "Name or style"}
          />
        </label>
      </div>
      {!examples && (
        <div className={styles.catalogOptions}>
          <label className={styles.selectLabel}>
            Export format
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
            >
              <option value="All">All formats</option>
              {["PDF", "Word", "HTML", "Text", "Markdown", "JSON"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          <label className={styles.selectLabel}>
            Columns
            <select
              value={columns}
              onChange={(event) => setColumns(event.target.value)}
            >
              <option value="All">All layouts</option>
              <option>Single column</option>
              <option>Sidebar</option>
            </select>
          </label>
          <label className={styles.selectLabel}>
            Career stage
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value)}
            >
              <option value="All">All stages</option>
              {["Early career", "Experienced", "Leadership"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className={styles.selectLabel}>
            Sample length
            <select
              value={length}
              onChange={(event) => setLength(event.target.value)}
            >
              <option value="short">Short resume</option>
              <option value="long">Long resume</option>
            </select>
          </label>
          <p>
            Free designs · PDF, Word, HTML, text, Markdown and JSON. Every
            design supports multiple pages; Word uses a single column. Career
            stages are suggestions.
          </p>
        </div>
      )}
      <p className={styles.resultCount} role="status">
        {filtered.length}{" "}
        {examples
          ? filtered.length === 1
            ? "example"
            : "examples"
          : filtered.length === 1
            ? "design"
            : "designs"}
      </p>
      {filtered.length ? (
        <div className={styles.galleryGrid}>
          {filtered.map((item) => (
            <article key={item.id} className={styles.galleryCard}>
              <Link
                href={`/${route}/${item.id}`}
                className={styles.previewLink}
                aria-label={`Preview ${item.name}`}
              >
                <ResumeThumbnail
                  doc={
                    length === "long" && !examples
                      ? designSample(item.doc.presentation.template, "long")
                      : item.doc
                  }
                />
              </Link>
              <div className={styles.cardText}>
                <span>{examples ? "Fictional example" : item.category}</span>
                <h2>
                  <Link href={`/${route}/${item.id}`}>{item.name}</Link>
                </h2>
                <p>{item.description}</p>
                {!examples && (
                  <p>
                    Free · {item.columns} ·{" "}
                    {length === "long" ? "Long sample" : "Short sample"}
                  </p>
                )}
                <Link href={`/${route}/${item.id}`} className={styles.textLink}>
                  {examples ? "Explore example" : "Inspect design"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <h2>No matches yet</h2>
          <p>Try another name or show the full collection.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("All");
              setColumns("All");
              setStage("All");
              setFormat("All");
            }}
          >
            Show all {examples ? "examples" : "designs"}
          </button>
        </div>
      )}
    </>
  );
}
