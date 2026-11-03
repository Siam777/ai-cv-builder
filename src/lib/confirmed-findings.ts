/**
 * Findings a person confirmed as true ("this number is right", "these dates
 * really overlap"), remembered per CV in this browser only. A finding ID
 * includes a hash of the text it is about, so editing that text reopens it.
 * Storage can be unavailable (private mode, blocked site data); then
 * confirmations last for the current page only.
 */
const key = (docId: string) => `cv-confirmed-findings:${docId}`;

export function loadConfirmed(docId: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(docId));
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [],
    );
  } catch {
    return new Set();
  }
}

export function saveConfirmed(docId: string, ids: Set<string>) {
  try {
    if (ids.size) localStorage.setItem(key(docId), JSON.stringify([...ids]));
    else localStorage.removeItem(key(docId));
  } catch {
    // Keep the in-memory set only.
  }
}

/** "Don't remind me for this version" before export, per CV and revision. */
const reminderKey = (docId: string) => `cv-export-reminder-off:${docId}`;

export function exportReminderSkipped(docId: string, revision: number) {
  try {
    return localStorage.getItem(reminderKey(docId)) === String(revision);
  } catch {
    return false;
  }
}

export function skipExportReminder(docId: string, revision: number) {
  try {
    localStorage.setItem(reminderKey(docId), String(revision));
  } catch {
    // The reminder shows again next time.
  }
}
