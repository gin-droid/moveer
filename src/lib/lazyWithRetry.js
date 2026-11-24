import { lazy } from 'react';

const RELOAD_KEY = 'moveerai-chunk-reload-at';
const RELOAD_WINDOW_MS = 30_000;

export function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch|Loading chunk|Unable to preload CSS/i.test(message);
}

// After a deploy the old hashed chunks disappear: reload once to fetch the new build.
export function reloadForNewBuild() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable: still try a single reload.
  }
  window.location.reload();
  return true;
}

/**
 * @template {import('react').ComponentType<any>} T
 * @param {() => Promise<{ default: T }>} factory
 */
export function lazyWithRetry(factory) {
  return lazy(() => factory().catch((error) => {
    if (isChunkLoadError(error) && reloadForNewBuild()) {
      return new Promise(() => {});
    }
    throw error;
  }));
}
