/**
 * Cache offline dei report di analisi.
 * Salva report e lista in localStorage così sono disponibili per
 * consultazione e generazione PDF anche senza connessione.
 */

const CACHE_KEY = "moVeerAI_report_cache";
const LIST_KEY = "moVeerAI_report_list";

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

export function removeCachedReport(id) {
  if (!id) return;
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    delete cache[id];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    const list = getCachedReportList().filter((r) => r.id !== id);
    localStorage.setItem(LIST_KEY, JSON.stringify({ reports: list, _cachedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function cacheReportList(reports) {
  if (!Array.isArray(reports)) return;
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify({ reports, _cachedAt: Date.now() }));
    // Cache anche ogni report singolarmente per il dettaglio offline
    reports.forEach((r) => cacheReport(r));
  } catch (e) {
    /* quota superata — ignora */
  }
}

export function getCachedReportList() {
  try {
    const data = JSON.parse(localStorage.getItem(LIST_KEY) || "null");
    return data?.reports || [];
  } catch {
    return [];
  }
}