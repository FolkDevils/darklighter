/**
 * Minimal localStorage JSON helpers — backs user presets/snapshots (PLAN.md
 * §8). Small subset of the reference app's `src/lib/persist.ts`; no debounce
 * variant since Phase 1's write volume (save/take-snapshot are explicit user
 * actions) doesn't need it.
 */
const NS = "darklighter:";

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch {
    // storage full/unavailable — non-fatal, just skip persistence
  }
}
