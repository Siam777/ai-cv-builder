/**
 * Findings a person chose to dismiss, remembered per CV in this browser only.
 * Storage can be unavailable (private mode, blocked site data); then
 * dismissals last for the current page only.
 */
const key = (docId: string) => `cv-dismissed-findings:${docId}`;

export function loadDismissed(docId: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(docId));
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveDismissed(docId: string, ids: Set<string>) {
  try {
    if (ids.size) localStorage.setItem(key(docId), JSON.stringify([...ids]));
    else localStorage.removeItem(key(docId));
  } catch {
    // Keep the in-memory set only.
  }
}
