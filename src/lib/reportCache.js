/**
 * Cache offline dei report di analisi.
 * Salva report e lista in localStorage così sono disponibili per
 * consultazione e generazione PDF anche senza connessione.
 */

const CACHE_KEY = "moVeerAI_report_cache";
const LIST_KEY = "moVeerAI_report_list";
const OWNER_KEY = "moVeerAI_report_owner";
const MAX_CACHED_REPORTS = 50;

function readCacheState() {
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (stored && stored.reports && typeof stored.reports === "object") {
      return { reports: stored.reports, list: Array.isArray(stored.list) ? stored.list : [] };
    }
    const legacyList = JSON.parse(localStorage.getItem(LIST_KEY) || "null");
    return {
      reports: stored && typeof stored === "object" ? stored : {},
      list: Array.isArray(legacyList?.reports) ? legacyList.reports : [],
    };
  } catch {
    return { reports: {}, list: [] };
  }
}

function writeCacheState(state) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    /* quota superata — ignora */
  }
}

function limitCacheState(state) {
  state.list = state.list.slice(0, MAX_CACHED_REPORTS);
  const ids = new Set(state.list.map((report) => report.id));
  state.reports = Object.fromEntries(Object.entries(state.reports).filter(([id]) => ids.has(id)));
  return state;
}

export function clearReportCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(LIST_KEY);
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* ignore */
  }
}

export function ensureReportCacheOwner(userId) {
  if (!userId) return;
  try {
    if (localStorage.getItem(OWNER_KEY) !== userId) clearReportCache();
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    /* storage non disponibile */
  }
}

export function cacheReport(report) {
  if (!report?.id) return;
  const state = readCacheState();
  const cached = { ...report, _cachedAt: Date.now() };
  state.reports[report.id] = cached;
  state.list = [cached, ...state.list.filter((item) => item.id !== report.id)];
  writeCacheState(limitCacheState(state));
}

export function getCachedReport(id) {
  if (!id) return null;
  try {
    return readCacheState().reports[id] || null;
  } catch {
    return null;
  }
}

export function removeCachedReport(id) {
  if (!id) return;
  try {
    const state = readCacheState();
    delete state.reports[id];
    state.list = state.list.filter((report) => report.id !== id);
    writeCacheState(state);
  } catch { /* ignore */ }
}

export function cacheReportList(reports) {
  if (!Array.isArray(reports)) return;
  const limitedReports = reports.filter((report) => report?.id).slice(0, MAX_CACHED_REPORTS)
    .map((report) => ({ ...report, _cachedAt: Date.now() }));
  const state = {
    list: limitedReports,
    reports: Object.fromEntries(limitedReports.map((report) => [report.id, report])),
  };
  writeCacheState(state);
}

export function getCachedReportList() {
  try {
    const state = readCacheState();
    return state.list.length ? state.list : Object.values(state.reports).slice(0, MAX_CACHED_REPORTS);
  } catch {
    return [];
  }
}