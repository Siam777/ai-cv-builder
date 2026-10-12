import { createDocument, type ResumeDocument } from "./document";

export type LibraryCollection = ResumeDocument["provenance"]["purpose"];

export function documentsInCollection(
  documents: ResumeDocument[],
  collection: LibraryCollection,
) {
  return documents.filter((doc) => doc.provenance.purpose === collection);
}

/** A design is reusable; the example's identity and career facts are not. */
export function startFromDesign(
  example: ResumeDocument,
  exampleId: string,
): ResumeDocument {
  const draft = createDocument();
  draft.presentation = structuredClone(example.presentation);
  draft.provenance = { purpose: "personal", origin: "example", exampleId };
  return draft;
}
