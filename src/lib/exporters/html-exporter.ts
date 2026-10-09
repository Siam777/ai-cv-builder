import {
  type ResumeDocument,
  type Entry,
  dateRange,
} from "../document";
import {
  accents,
  densities,
  fonts,
  pageMetrics,
  type Presentation,
} from "../presentation";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function exportToStandaloneHtml(
  doc: ResumeDocument,
  options?: { showWatermark?: boolean },
): string {
  const p = doc.presentation;
  const metrics = pageMetrics(p);
  const accentHex = accents[p.accent];
  const fontFamily = fonts[p.font].family;
  const showWatermark = options?.showWatermark ?? false;

  const sectionsHtml = doc.sections
    .filter((s) => s.visible && s.entries.length > 0)
    .map((s) => {
      const entriesHtml = s.entries
        .map((e) => {
          const titleOrg = [e.title, e.organization]
            .filter(Boolean)
            .map(escapeHtml)
            .join(" &middot; ");

          const meta = [e.location, dateRange(e)]
            .filter(Boolean)
            .map(escapeHtml)
            .join(" | ");

          const descHtml = e.description
            ? `<p class="entry-desc">${escapeHtml(e.description)}</p>`
            : "";

          const bulletsHtml =
            e.bullets.length > 0
              ? `<ul class="bullets">${e.bullets
                  .filter((b) => b.text.trim())
                  .map((b) => `<li>${escapeHtml(b.text)}</li>`)
                  .join("")}</ul>`
              : "";

          return `
          <div class="entry">
            ${titleOrg ? `<h3 class="entry-title">${titleOrg}</h3>` : ""}
            ${meta ? `<div class="entry-meta">${meta}</div>` : ""}
            ${descHtml}
            ${bulletsHtml}
          </div>`;
        })
        .join("\n");

      return `
      <section class="resume-section">
        <h2 class="section-heading">${escapeHtml(s.label)}</h2>
        ${entriesHtml}
      </section>`;
    })
    .join("\n");

  const contactItems: string[] = [];
  if (doc.contact.email) {
    contactItems.push(
      `<a href="mailto:${escapeHtml(doc.contact.email)}">${escapeHtml(doc.contact.email)}</a>`,
    );
  }
  if (doc.contact.phone) {
    contactItems.push(`<span>${escapeHtml(doc.contact.phone)}</span>`);
  }
  if (doc.contact.location) {
    contactItems.push(`<span>${escapeHtml(doc.contact.location)}</span>`);
  }
  if (doc.contact.website) {
    const url = doc.contact.website.startsWith("http")
      ? doc.contact.website
      : `https://${doc.contact.website}`;
    contactItems.push(
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(doc.contact.website)}</a>`,
    );
  }

  const watermarkHtml = showWatermark
    ? `<div class="watermark-footer">Created with AI CV Builder</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="${p.direction === "rtl" ? "ar" : "en"}" dir="${p.direction ?? "ltr"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(doc.name || doc.contact.name || "Resume")}</title>
  <style>
    :root {
      --accent: ${accentHex};
      --font: ${fontFamily};
      --body-size: ${p.fontSize}pt;
      --leading: ${densities[p.density].lineHeight};
      --page-margin: ${metrics.margin}mm;
      --page-width: ${metrics.width}mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 30px 20px;
      background: #f4f6f3;
      font-family: var(--font);
      font-size: var(--body-size);
      line-height: var(--leading);
      color: #26322c;
      -webkit-font-smoothing: antialiased;
      direction: ${p.direction ?? "ltr"};
      ${p.direction === "rtl" ? "text-align: right;" : ""}
    }
    ${
      p.direction === "rtl"
        ? `
    ul.bullets {
      padding-left: 0;
      padding-right: 18px;
    }
    `
        : ""
    }
    .page-sheet {
      max-width: var(--page-width);
      margin: 0 auto;
      background: #ffffff;
      padding: var(--page-margin);
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      position: relative;
      direction: ${p.direction ?? "ltr"};
    }
    header.resume-header {
      margin-bottom: 16pt;
    }
    h1.name {
      margin: 0 0 4pt;
      font-size: 26pt;
      line-height: 1.15;
      color: #1a221d;
    }
    .headline {
      font-size: 12pt;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 6pt;
    }
    .contact-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 9pt;
      color: #556358;
    }
    .contact-row a {
      color: inherit;
      text-decoration: none;
    }
    .contact-row a:hover {
      text-decoration: underline;
    }
    .resume-section {
      margin-top: 14pt;
    }
    h2.section-heading {
      font-size: 10pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2pt;
      color: var(--accent);
      border-bottom: 0.8pt solid #d6ded7;
      padding-bottom: 4pt;
      margin: 0 0 8pt;
    }
    .entry {
      margin-bottom: 10pt;
    }
    .entry:last-child {
      margin-bottom: 0;
    }
    h3.entry-title {
      font-size: 10.5pt;
      font-weight: 700;
      margin: 0 0 2pt;
    }
    .entry-meta {
      font-size: 8.5pt;
      color: #5b695e;
      margin-bottom: 4pt;
    }
    .entry-desc {
      margin: 0 0 4pt;
    }
    ul.bullets {
      margin: 2pt 0 0;
      padding-left: 14pt;
    }
    ul.bullets li {
      margin-bottom: 2pt;
    }
    .watermark-footer {
      text-align: center;
      font-size: 7.5pt;
      color: #8c9789;
      margin-top: 24pt;
      padding-top: 8pt;
      border-top: 0.5pt solid #eaecea;
    }
    .header-layout {
      display: flex;
      align-items: center;
      gap: 16pt;
    }
    .header-photo {
      width: 56pt;
      height: 56pt;
      border-radius: 50%;
      object-fit: cover;
      border: 1.5pt solid var(--accent);
      flex-shrink: 0;
    }
    .header-text {
      flex: 1;
    }
    @media print {
      @page {
        size: ${metrics.width}mm ${metrics.height}mm;
        margin: 0;
      }
      body {
        background: transparent;
        padding: 0;
        margin: 0;
      }
      .page-sheet {
        box-shadow: none;
        max-width: none;
        width: 100%;
        margin: 0;
        padding: var(--page-margin);
      }
      a {
        color: inherit !important;
      }
    }
  </style>
</head>
<body>
  <div class="page-sheet">
    <header class="resume-header">
      <div class="header-layout">
        ${
          doc.contact.photoUrl
            ? `<img src="${escapeHtml(doc.contact.photoUrl)}" alt="Profile Photo" class="header-photo"/>`
            : ""
        }
        <div class="header-text">
          <h1 class="name">${escapeHtml(doc.contact.name || "Resume")}</h1>
          ${doc.contact.headline ? `<div class="headline">${escapeHtml(doc.contact.headline)}</div>` : ""}
          ${contactItems.length > 0 ? `<div class="contact-row">${contactItems.join(" &middot; ")}</div>` : ""}
        </div>
      </div>
    </header>

    <main class="resume-body">
      ${sectionsHtml}
    </main>

    ${watermarkHtml}
  </div>
</body>
</html>`;
}
