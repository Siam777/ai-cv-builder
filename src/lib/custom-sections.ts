import {
  type Entry,
  type Section,
  type ResumeDocument,
  uid,
  newEntry,
} from "./document";

export interface CustomSectionPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  exampleTitle: string;
  exampleOrg: string;
  exampleLocation: string;
  exampleStart: string;
  exampleEnd: string;
  exampleCurrent: boolean;
  exampleDescription: string;
  exampleBullet: string;
}

export const CUSTOM_SECTION_PRESETS: CustomSectionPreset[] = [
  {
    id: "volunteer",
    label: "Volunteer Experience",
    description: "Community involvement, non-profit contributions, and pro-bono initiatives",
    icon: "🤝",
    exampleTitle: "Volunteer Engineering Lead",
    exampleOrg: "Code for Good / Local Community Foundation",
    exampleLocation: "San Francisco, CA",
    exampleStart: "2022-01",
    exampleEnd: "",
    exampleCurrent: true,
    exampleDescription: "Led engineering volunteers building open-source accessibility tools for non-profit partners.",
    exampleBullet: "Organized weekly workshops and deployed 3 web tools serving over 1,200 local community families.",
  },
  {
    id: "publications",
    label: "Publications & Research",
    description: "Peer-reviewed papers, conference proceedings, technical whitepapers, or book chapters",
    icon: "📚",
    exampleTitle: "Co-Author, Scaling Distributed Cache Invalidation",
    exampleOrg: "ACM Transactions / IEEE Cloud Computing",
    exampleLocation: "New York, NY",
    exampleStart: "2023",
    exampleEnd: "",
    exampleCurrent: false,
    exampleDescription: "Peer-reviewed research paper examining consistent hashing and replication latency tradeoffs.",
    exampleBullet: "Presented research findings at International Cloud Systems Symposium with 500+ academic attendees.",
  },
  {
    id: "speaking",
    label: "Speaking & Conferences",
    description: "Keynotes, conference talks, podcast appearances, and technical workshop presentations",
    icon: "🎙️",
    exampleTitle: "Keynote Speaker: Zero-Downtime Microservices",
    exampleOrg: "DevOps Days / Cloud Native Summit",
    exampleLocation: "Austin, TX",
    exampleStart: "2023-09",
    exampleEnd: "",
    exampleCurrent: false,
    exampleDescription: "45-minute technical session on progressive deployment pipelines and canary routing.",
    exampleBullet: "Delivered interactive keynote to 600+ engineers; rated top-3 session of the conference.",
  },
  {
    id: "awards",
    label: "Awards & Honors",
    description: "Industry honors, hackathon victories, scholarships, and corporate recognition",
    icon: "🏆",
    exampleTitle: "1st Place Winner, Global FinTech Hackathon",
    exampleOrg: "FinTech Innovation Lab",
    exampleLocation: "London, UK",
    exampleStart: "2022-11",
    exampleEnd: "",
    exampleCurrent: false,
    exampleDescription: "Built an AI-assisted fraud detection pipeline within a 48-hour competitive sprint.",
    exampleBullet: "Awarded Grand Prize out of 120 international engineering teams.",
  },
  {
    id: "patents",
    label: "Patents & Inventions",
    description: "Issued or pending patents, intellectual property, and proprietary algorithms",
    icon: "💡",
    exampleTitle: "Patent US11849201B2: Adaptive Query Routing in Heterogeneous Databases",
    exampleOrg: "US Patent and Trademark Office",
    exampleLocation: "Washington, DC",
    exampleStart: "2021",
    exampleEnd: "2023",
    exampleCurrent: false,
    exampleDescription: "Distributed query execution architecture reducing cold-start latency across sharded nodes.",
    exampleBullet: "Granted full patent status; implemented into core production cloud infrastructure.",
  },
  {
    id: "teaching",
    label: "Teaching & Mentorship",
    description: "Course instruction, corporate tech training, university TA roles, or developer mentorship",
    icon: "🎓",
    exampleTitle: "Adjunct Instructor, Cloud Systems Architecture",
    exampleOrg: "City University Department of Computer Science",
    exampleLocation: "Boston, MA",
    exampleStart: "2021-09",
    exampleEnd: "2023-05",
    exampleCurrent: false,
    exampleDescription: "Designed syllabus and taught evening course for 40 senior undergraduate engineers.",
    exampleBullet: "Mentored 12 student capstone projects resulting in 8 production open-source releases.",
  },
  {
    id: "leadership",
    label: "Leadership & Activities",
    description: "Advisory boards, employee resource groups (ERGs), or professional societies",
    icon: "🌟",
    exampleTitle: "Chapter President & Regional Lead",
    exampleOrg: "Association for Computing Machinery (ACM)",
    exampleLocation: "Seattle, WA",
    exampleStart: "2020-06",
    exampleEnd: "2022-12",
    exampleCurrent: false,
    exampleDescription: "Fostered technical community engagement, quarterly hackathons, and technical workshop series.",
    exampleBullet: "Grew active regional membership from 80 to 350+ members over an 18-month tenure.",
  },
];

/**
 * Creates a new custom Section from a predefined preset.
 */
export function createCustomSectionFromPreset(
  presetId: string,
  withExample = false,
): Section {
  const preset = CUSTOM_SECTION_PRESETS.find((p) => p.id === presetId);
  const label = preset ? preset.label : "Custom Section";

  const entries: Entry[] = [];
  if (withExample && preset) {
    entries.push({
      id: uid(),
      title: preset.exampleTitle,
      organization: preset.exampleOrg,
      location: preset.exampleLocation,
      start: preset.exampleStart,
      end: preset.exampleEnd,
      current: preset.exampleCurrent,
      description: preset.exampleDescription,
      bullets: preset.exampleBullet
        ? [{ id: uid(), text: preset.exampleBullet }]
        : [],
    });
  } else {
    entries.push(newEntry());
  }

  return {
    id: uid(),
    type: "custom",
    label,
    visible: true,
    entries,
  };
}

export interface SavedCustomSection {
  id: string;
  label: string;
  savedAt: string;
  entries: Entry[];
}

const STORAGE_KEY = "cv_custom_sections_library";

/**
 * Retrieves saved custom sections from the candidate's reusable section library.
 */
export function getSavedCustomSectionsLibrary(): SavedCustomSection[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves or updates a custom section in the candidate's reusable section library.
 */
export function saveCustomSectionToLibrary(section: Section): SavedCustomSection {
  const library = getSavedCustomSectionsLibrary();
  const existingIdx = library.findIndex(
    (item) => item.label.toLowerCase() === section.label.toLowerCase(),
  );

  const savedItem: SavedCustomSection = {
    id: existingIdx !== -1 ? library[existingIdx].id : uid(),
    label: section.label.trim() || "Custom Section",
    savedAt: new Date().toISOString(),
    entries: structuredClone(section.entries),
  };

  if (existingIdx !== -1) {
    library[existingIdx] = savedItem;
  } else {
    library.unshift(savedItem);
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    } catch {
      // Ignore quota errors
    }
  }

  return savedItem;
}

/**
 * Removes a custom section from the reusable section library.
 */
export function removeCustomSectionFromLibrary(id: string): void {
  const library = getSavedCustomSectionsLibrary();
  const filtered = library.filter((item) => item.id !== id);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore quota errors
    }
  }
}

/**
 * Scans other resumes to discover reusable custom sections that the candidate has previously drafted.
 */
export function getReusableSectionsFromDocuments(
  docs: ResumeDocument[],
  currentDocumentId?: string,
): { sourceResumeName: string; section: Section }[] {
  const results: { sourceResumeName: string; section: Section }[] = [];
  const seenLabels = new Set<string>();

  for (const doc of docs) {
    if (doc.id === currentDocumentId) continue;
    for (const sec of doc.sections) {
      if (sec.type === "custom" && sec.entries.length > 0) {
        const key = sec.label.toLowerCase();
        if (!seenLabels.has(key)) {
          seenLabels.add(key);
          results.push({
            sourceResumeName: doc.name,
            section: structuredClone(sec),
          });
        }
      }
    }
  }

  return results;
}
