/**
 * Cache offline dei report di analisi.
 * Salva i report in localStorage così sono disponibili per
 * generazione PDF e consultazione anche senza connessione.
 */

const CACHE_KEY = "moVeerAI_report_cache";

export function cacheReport(report) {
  if (!report?.id) return;
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    cache[report.id] = { ...report, _cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    /* quota superata — ignora */
  }
}

export function getCachedReport(id) {
  if (!id) return null;
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return cache[id] || null;
  } catch {
    return null;
  }
}