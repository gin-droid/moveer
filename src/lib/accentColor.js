/**
 * Gestione del colore accentato del tema (offline-first).
 * Il colore viene salvato in localStorage per la persistenza offline
 * e sincronizzato sul profilo utente (accent_color) per il cross-device.
 */

const STORAGE_KEY = "moVeerAI_accent_color";
const DEFAULT_HSL = "76 100% 58%"; // lime (default attuale)

export const DEFAULT_ACCENT = DEFAULT_HSL;
const HSL_PATTERN = /^(\d{1,3}) (\d{1,3})% (\d{1,3})%$/;

function isValidHsl(value) {
  const match = typeof value === "string" && value.match(HSL_PATTERN);
  return !!match && Number(match[1]) <= 360 && Number(match[2]) <= 100 && Number(match[3]) <= 100;
}

/** Palette di colori che si abbinano bene al tema nero. */
export const ACCENT_COLORS = [
  { id: "lime",     label: "Lime",      hsl: "76 100% 58%" },
  { id: "emerald",  label: "Smeraldo",  hsl: "160 84% 55%" },
  { id: "cyan",     label: "Ciano",     hsl: "190 95% 55%" },
  { id: "blue",     label: "Blu",       hsl: "215 90% 62%" },
  { id: "violet",   label: "Viola",    hsl: "265 85% 68%" },
  { id: "magenta",  label: "Magenta",  hsl: "330 85% 62%" },
  { id: "red",      label: "Rosso",    hsl: "0 80% 62%" },
  { id: "orange",   label: "Arancione", hsl: "30 95% 58%" },
  { id: "amber",    label: "Ambra",    hsl: "45 95% 58%" },
];

const DARK_FG = "0 0% 4%"; // primary-foreground resta near-black per contrasto

/** Applica il colore ai CSS variable del tema (live). */
export function applyAccentColor(hsl) {
  if (!isValidHsl(hsl) || typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--primary-foreground", DARK_FG);
  root.style.setProperty("--accent", hsl);
  root.style.setProperty("--accent-foreground", DARK_FG);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--sidebar-primary-foreground", DARK_FG);
  root.style.setProperty("--sidebar-ring", hsl);
  root.style.setProperty("--chart-1", hsl);
}

/** Legge il colore salvato localmente (offline-first). */
export function getStoredAccentColor() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidHsl(stored) ? stored : DEFAULT_HSL;
  } catch {
    return DEFAULT_HSL;
  }
}

/** Salva in localStorage + applica immediatamente. */
export function setStoredAccentColor(hsl) {
  if (!isValidHsl(hsl)) return;
  try {
    localStorage.setItem(STORAGE_KEY, hsl);
  } catch { /* ignore */ }
  applyAccentColor(hsl);
}

/** Da chiamare all'avvio dell'app: applica il colore salvato prima del render. */
export function initAccentColor() {
  applyAccentColor(getStoredAccentColor());
}