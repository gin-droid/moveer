import { base44 } from "@/api/base44Client";

/**
 * Costruisce una query MongoDB-style per filtrare gli esercizi in base
 * alle preferenze dell'utente (preferred_macro_categories, preferred_equipment).
 * Ritorna null se l'utente non ha preferenze (carica tutto il catalogo).
 */
export function buildExerciseQuery(user) {
  const q = {};
  const macros = user?.preferred_macro_categories;
  const equips = user?.preferred_equipment;
  if (Array.isArray(macros) && macros.length) q.macro_category = { $in: macros };
  if (Array.isArray(equips) && equips.length) q.equipment = { $in: equips };
  return Object.keys(q).length ? q : null;
}

/**
 * Carica gli esercizi filtrati per le preferenze dell'utente (server-side).
 * Se l'utente non ha preferenze, carica tutto il catalogo.
 */
export async function loadPreferredExercises(user, sort = "-created_date", limit = 1000) {
  const query = buildExerciseQuery(user);
  return query
    ? base44.entities.Exercise.filter(query, sort, limit)
    : base44.entities.Exercise.list(sort, limit);
}