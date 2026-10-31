"use client";

import { useSyncExternalStore } from "react";
import { parseTheme, THEME_KEY } from "./theme";

function snapshot() {
  return parseTheme(document.documentElement.dataset.theme ?? null);
}

function subscribe(notify: () => void) {
  function sync(event: Event) {
    if (event instanceof StorageEvent && event.key !== THEME_KEY && event.key !== null) return;
    if (event instanceof StorageEvent) {
      document.documentElement.dataset.theme = parseTheme(event.newValue);
    }
    notify();
  }
  window.addEventListener("storage", sync);
  window.addEventListener("brightloop-theme-change", sync);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener("brightloop-theme-change", sync);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "system");
  return <label className="flex items-center gap-2 text-sm text-muted">
    Theme
    <select aria-label="Color theme" value={theme} onChange={(event) => {
      const next = parseTheme(event.target.value);
      document.documentElement.dataset.theme = next;
      // The control still works when the browser blocks persistent storage.
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      window.dispatchEvent(new Event("brightloop-theme-change"));
    }} className="min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-foreground focus-visible:outline-primary">
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>;
}
