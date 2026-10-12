import type { ResumeDocument } from "./document";

/** A letter shares presentation and contact facts, with only the reviewed letter body. */
export function letterDocument(
  source: ResumeDocument,
  text: string,
): ResumeDocument {
  const doc = structuredClone(source);
  doc.name = "Cover letter";
  doc.contact.photoUrl = "";
  doc.sections = [
    {
      id: "cover-letter",
      type: "custom",
      label: "Cover letter",
      visible: true,
      entries: [
        {
          id: "letter-body",
          title: "",
          organization: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: text,
          bullets: [],
        },
      ],
    },
  ];
  return doc;
}
