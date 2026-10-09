import { dateRange, type ResumeDocument } from "./document";

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
  if (c.photoUrl && doc.presentation?.showPhoto !== false) {
    blocks.push({
      id: "photo",
      kind: "photo",
      text: c.photoUrl,
      keepNext: true,
    });
  }
  blocks.push({ id: "name", kind: "name", text: c.name || "Your name", keepNext: true });
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
    if (value) blocks.push({ id: field!, kind: "contact", text: value, href });
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
  const heights = elements.map((el) => el.getBoundingClientRect().height);
  const pages: LayoutBlock[][] = [[]];
  let used = 0;
  const nextPage = () => {
    if (pages.at(-1)!.length) {
      pages.push([]);
      used = 0;
    }
  };
  const add = (block: LayoutBlock, height: number) => {
    pages.at(-1)!.push(block);
    used += height;
  };
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const height = heights[i];
    // Keep short entries intact, and headings with the first meaningful lines.
    let keepHeight = height > capacity ? 42 : height;
    if (block.group && blocks[i - 1]?.group !== block.group) {
      let groupHeight = height;
      for (
        let j = i + 1;
        j < blocks.length && blocks[j].group === block.group;
        j++
      )
        groupHeight += heights[j];
      if (groupHeight <= capacity * 0.45) keepHeight = groupHeight;
    }
    if (block.keepNext) {
      let j = i;
      let chainHeight = height;
      while (blocks[j]?.keepNext && j + 1 < blocks.length) {
        j++;
        chainHeight += blocks[j].keepNext
          ? heights[j]
          : Math.min(heights[j], 42);
      }
      keepHeight = Math.max(keepHeight, Math.min(chainHeight, capacity));
    }
    if (block.kind === "section" && blocks[i + 1]?.group) {
      const nextGroup = blocks[i + 1].group;
      let groupHeight = 0;
      for (
        let j = i + 1;
        j < blocks.length && blocks[j].group === nextGroup;
        j++
      )
        groupHeight += heights[j];
      if (groupHeight <= capacity * 0.45)
        keepHeight = Math.max(keepHeight, height + groupHeight);
    }
    if (used && keepHeight > capacity - used) nextPage();
    if (height <= capacity - used) {
      add(block, height);
      continue;
    }
    if (height <= capacity) {
      nextPage();
      add(block, height);
      continue;
    }

    const probe = elements[i].cloneNode(true) as HTMLElement;
    root.append(probe);
    const content = probe.querySelector("[data-block-text]") ?? probe;
    const graphemes = Array.from(
      segmenter.segment(block.text),
      (s) => s.segment,
    );
    let offset = 0;
    try {
      while (offset < graphemes.length) {
        let low = 0,
          high = graphemes.length - offset;
        const available = capacity - used;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          content.textContent = graphemes.slice(offset, offset + mid).join("");
          if (probe.getBoundingClientRect().height <= available) low = mid;
          else high = mid - 1;
        }
        if (!low) {
          if (!used)
            throw new Error(
              "This layout cannot fit one line on the page. Choose a smaller font or a denser layout.",
            );
          nextPage();
          continue;
        }
        // Prefer a nearby word break without sacrificing an entire line for unbroken strings.
        if (offset + low < graphemes.length) {
          const floor = Math.max(1, low - 35);
          for (let k = low; k >= floor; k--)
            if (/\s/.test(graphemes[offset + k - 1])) {
              low = k;
              break;
            }
        }
        const text = graphemes.slice(offset, offset + low).join("");
        content.textContent = text;
        add(
          {
            ...block,
            id: `${block.id}-part-${offset}`,
            text,
            continued: offset > 0,
          },
          probe.getBoundingClientRect().height,
        );
        offset += low;
        if (offset < graphemes.length) nextPage();
      }
    } finally {
      probe.remove();
    }
  }
  return pages;
}
