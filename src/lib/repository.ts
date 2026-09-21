import { documentSchema, type ResumeDocument } from "./document";

export class ConflictError extends Error {
  constructor() {
    super(
      "This resume changed in another tab. Download a backup of your edits, then reload to get the saved version.",
    );
  }
}
export interface ResumeRepository {
  list(): Promise<ResumeDocument[]>;
  save(
    doc: ResumeDocument,
    expectedRevision: number | null,
  ): Promise<ResumeDocument>;
  remove(id: string, expectedRevision: number): Promise<void>;
}
export function createRepository(
  databaseName = "cv-builder",
): ResumeRepository {
  let connection: Promise<IDBDatabase> | undefined;
  const open = () =>
    (connection ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("resumes", { keyPath: "id" });
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => {
        connection = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        connection = undefined;
        reject(new Error("Close other resume tabs and try again."));
      };
    }));
  return {
    async list() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const request = db
          .transaction("resumes")
          .objectStore("resumes")
          .getAll();
        request.onsuccess = () => {
          try {
            resolve(
              request.result
                .map((d) => documentSchema.parse(d))
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
            );
          } catch {
            reject(
              new Error(
                "Stored data could not be read. Existing records have been preserved.",
              ),
            );
          }
        };
        request.onerror = () => reject(request.error);
      });
    },
    async save(input, expectedRevision) {
      const result = documentSchema.safeParse(input);
      if (!result.success)
        throw new Error(
          "Check your entries before saving. Dates must be blank, YYYY, or YYYY-MM with a valid month. All text and entry counts must stay within the supported limits. Your edits remain available for correction.",
        );
      const parsed = result.data;
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("resumes", "readwrite");
        const store = tx.objectStore("resumes");
        let result: ResumeDocument;
        let failure: Error | undefined;
        const request = store.get(parsed.id);
        request.onsuccess = () => {
          const old = request.result as ResumeDocument | undefined;
          if (
            (expectedRevision === null && old) ||
            (expectedRevision !== null &&
              (!old || old.revision !== expectedRevision))
          ) {
            failure = new ConflictError();
            tx.abort();
            return;
          }
          result = {
            ...parsed,
            revision: (expectedRevision ?? -1) + 1,
            updatedAt: new Date().toISOString(),
          };
          store.put(result);
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = () =>
          reject(
            failure ??
              tx.error ??
              new Error("Saving failed. Download a backup to keep your edits."),
          );
        tx.onerror = () => {
          /* onabort reports the final transaction outcome */
        };
      });
    },
    async remove(id, expectedRevision) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("resumes", "readwrite");
        const store = tx.objectStore("resumes");
        let failure: Error | undefined;
        const request = store.get(id);
        request.onsuccess = () => {
          if (!request.result || request.result.revision !== expectedRevision) {
            failure = new ConflictError();
            tx.abort();
          } else store.delete(id);
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(failure ?? tx.error ?? new Error("Could not delete resume."));
      });
    },
  };
}
