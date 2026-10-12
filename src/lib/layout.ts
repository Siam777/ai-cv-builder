import { dateRange, type ResumeDocument } from "./document";
import { templates } from "./presentation";

export type LayoutBlock = {
  id: string;
  kind:
    | "name"
    | "headline"
    | "contact"
    | "section"
    | "title"
    | "meta"
    | "paragraph"
    | "bullet"
    | "photo";
  text: string;
  href?: string;
  group?: string;
  keepNext?: boolean;
  continued?: boolean;
  sidebarRow?: number;
  date?: string;
  details?: string;
};
function safeWebsite(value: string) {
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`,
    );
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function layoutBlocks(doc: ResumeDocument): LayoutBlock[] {
  const c = doc.contact;
  const blocks: LayoutBlock[] = [];
  if (
    c.photoUrl &&
    /^data:image\/(?:png|jpeg|webp|svg\+xml)[;,]/i.test(c.photoUrl) &&
    doc.presentation?.showPhoto !== false &&
    templates.find((template) => template.id === doc.presentation.template)
      ?.photoSupported
  ) {
    blocks.push({
      id: "photo",
      kind: "photo",
      text: c.photoUrl,
      keepNext: true,
    });
  }
  blocks.push({
    id: "name",
    kind: "name",
    text: c.name || "Your name",
    keepNext: true,
  });
  if (c.headline)
    blocks.push({
      id: "headline",
      kind: "headline",
      text: c.headline,
      keepNext: true,
    });
  for (const [field, value, href] of [
    ["location", c.location, undefined],
    ["email", c.email, `mailto:${c.email}`],
    ["phone", c.phone, `tel:${c.phone.replace(/[^+\d]/g, "")}`],
    ["website", c.website, safeWebsite(c.website)],
  ])
    if (value)
      blocks.push({
        id: field!,
        kind: "contact",
        text: value,
        href,
        sidebarRow:
          blocks.filter((block) => block.kind === "contact").length + 1,
      });
  for (const section of doc.sections.filter(
    (s) =>
      s.visible &&
      s.entries.some((entry) =>
        [
          entry.title,
          entry.organization,
          entry.location,
          entry.description,
          dateRange(entry),
          ...entry.bullets.map((b) => b.text),
        ].some((value) => value.trim()),
      ),
  )) {
    blocks.push({
      id: section.id,
      kind: "section",
      text: section.label,
      keepNext: true,
    });
    for (const entry of section.entries) {
      const group = entry.id;
      if (entry.title)
        blocks.push({
          id: `${group}-title`,
          kind: "title",
          text: entry.title,
          group,
          keepNext: true,
        });
      const meta = [entry.organization, entry.location, dateRange(entry)]
        .filter(Boolean)
        .join(" · ");
      if (meta)
        blocks.push({
          id: `${group}-meta`,
          kind: "meta",
          text: meta,
          date: dateRange(entry),
          details: [entry.organization, entry.location]
            .filter(Boolean)
            .join(" · "),
          group,
          keepNext: true,
        });
      if (entry.description)
        blocks.push({
          id: `${group}-description`,
          kind: "paragraph",
          text: entry.description,
          group,
        });
      for (const bullet of entry.bullets.filter((b) => b.text))
        blocks.push({
          id: bullet.id,
          kind: "bullet",
          text: bullet.text,
          group,
        });
      // Never bind a final heading to a different entry or section.
      if (blocks.at(-1)?.group === group) blocks.at(-1)!.keepNext = false;
    }
  }
  return blocks;
}

/** Uses the browser's actual typesetting, at print dimensions, to place blocks.
 * Large text is split at measured grapheme boundaries; source strings are never changed.
 */
export function paginateBlocks(
  blocks: LayoutBlock[],
  root: HTMLElement,
  capacity: number,
): LayoutBlock[][] {
  const elements = Array.from(root.children) as HTMLElement[];
  const pages: LayoutBlock[][] = [[]];
  // Measure each candidate in its own page context. Inline contacts and sidebar
  // rows share vertical space; summing their individual heights counts it twice.
  const pageRoot = root.cloneNode(false) as HTMLElement;
  const emptyRoot = root.cloneNode(false) as HTMLElement;
  for (const probeRoot of [pageRoot, emptyRoot]) {
    probeRoot.style.width = `${root.getBoundingClientRect().width}px`;
    probeRoot.style.height = "auto";
    probeRoot.style.minHeight = "0";
    root.parentElement!.append(probeRoot);
  }
  type Candidate = {
    index: number;
    text?: string;
    continued?: boolean;
    firstLines?: boolean;
  };
  const nodeFor = (candidate: Candidate) => {
    const node = elements[candidate.index].cloneNode(true) as HTMLElement;
    if (
      candidate.text !== undefined &&
      candidate.text !== blocks[candidate.index].text
    )
      (node.querySelector("[data-block-text]") ?? node).textContent =
        candidate.text;
    if (candidate.continued) node.classList.add("continued");
    if (candidate.firstLines) {
      node.style.maxHeight = "42px";
      node.style.overflow = "hidden";
    }
    return node;
  };
  const measure = (candidates: Candidate[], withCurrent = true) => {
    const target = withCurrent ? pageRoot : emptyRoot;
    const nodes = candidates.map(nodeFor);
    target.append(...nodes);
    const top = target.getBoundingClientRect().top;
    const height = Math.max(
      target.getBoundingClientRect().height,
      ...Array.from(
        target.children,
        (node) => node.getBoundingClientRect().bottom - top,
      ),
    );
    for (const node of nodes) node.remove();
    return height;
  };
  const nextPage = () => {
    if (pages.at(-1)!.length) {
      pages.push([]);
      pageRoot.replaceChildren();
    }
  };
  const add = (block: LayoutBlock, candidate: Candidate) => {
    pages.at(-1)!.push(block);
    pageRoot.append(nodeFor(candidate));
  };
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  try {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const candidate = { index: i };
      const height = measure([candidate], false);
      // Keep short entries intact, and headings with the first meaningful lines.
      let keep: Candidate[] = [{ index: i, firstLines: height > capacity }];
      if (block.keepNext) {
        let j = i;
        while (blocks[j]?.keepNext && j + 1 < blocks.length) {
          j++;
          keep.push({
            index: j,
            firstLines:
              !blocks[j].keepNext || measure([{ index: j }], false) > capacity,
          });
        }
      }
      const groupStart = block.kind === "section" ? i + 1 : i;
      const group = blocks[groupStart]?.group;
      if (group && (groupStart !== i || blocks[i - 1]?.group !== group)) {
        const entry: Candidate[] = [];
        for (
          let j = groupStart;
          j < blocks.length && blocks[j].group === group;
          j++
        )
          entry.push({ index: j });
        if (measure(entry, false) <= capacity * 0.45) {
          const together =
            block.kind === "section" ? [candidate, ...entry] : entry;
          if (measure(together, false) >= measure(keep, false)) keep = together;
        }
      }
      if (
        pages.at(-1)!.length &&
        measure(keep, false) <= capacity &&
        measure(keep) > capacity
      )
        nextPage();
      if (measure([candidate]) <= capacity) {
        add(block, candidate);
        continue;
      }
      if (height <= capacity) {
        nextPage();
        add(block, candidate);
        continue;
      }

      const graphemes = Array.from(
        segmenter.segment(block.text),
        (s) => s.segment,
      );
      let offset = 0;
      while (offset < graphemes.length) {
        let low = 0,
          high = graphemes.length - offset;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          const text = graphemes.slice(offset, offset + mid).join("");
          if (measure([{ index: i, text, continued: offset > 0 }]) <= capacity)
            low = mid;
          else high = mid - 1;
        }
        if (!low) {
          if (!pages.at(-1)!.length)
            throw new Error(
              "This layout cannot fit one line on the page. Choose a smaller font or a denser layout.",
            );
          nextPage();
          continue;
        }
        // Prefer a nearby word break without dropping any source whitespace.
        if (offset + low < graphemes.length) {
          const floor = Math.max(1, low - 35);
          for (let k = low; k >= floor; k--)
            if (/\s/.test(graphemes[offset + k - 1])) {
              low = k;
              break;
            }
        }
        const text = graphemes.slice(offset, offset + low).join("");
        add(
          {
            ...block,
            id: `${block.id}-part-${offset}`,
            text,
            continued: offset > 0,
          },
          { index: i, text, continued: offset > 0 },
        );
        offset += low;
        if (offset < graphemes.length) nextPage();
      }
    }
    return pages;
  } finally {
    pageRoot.remove();
    emptyRoot.remove();
  }
}
