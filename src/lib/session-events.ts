const key = "cv-session-change";
export function notifySessionChange() {
  window.dispatchEvent(new Event(key));
  try {
    localStorage.setItem(key, `${Date.now()}-${Math.random()}`);
  } catch {
    /* Refresh on focus remains available. */
  }
}
export function watchSessionChanges(refresh: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === key) refresh();
  };
  const visible = () => {
    if (document.visibilityState === "visible") refresh();
  };
  window.addEventListener(key, refresh);
  window.addEventListener("storage", storage);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", visible);
  const timer = setInterval(refresh, 30000);
  return () => {
    clearInterval(timer);
    window.removeEventListener(key, refresh);
    window.removeEventListener("storage", storage);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", visible);
  };
}
