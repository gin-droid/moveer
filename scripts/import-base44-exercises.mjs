import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const catalogUrl = 'https://moveer.base44.app/api/apps/6a89626b6a539e66178e33a2/entities/Exercise?limit=1000&sort=-created_date';
const allowedCategories = new Set([
  'Forza', 'Powerlifting', 'Body Building', 'Calisthenics', 'Corpo Libero',
  'Cardio', 'Mobilità', 'Funzionale', 'Ciclismo', 'Camminata', 'Corsa',
  'Kettlebell', 'Posturali', 'Riabilitazione',
]);
const allowedDifficulties = new Set(['Principiante', 'Intermedio', 'Avanzato']);

const sqlText = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const sqlArray = (value) => `ARRAY[${(Array.isArray(value) ? value : []).map(sqlText).join(', ')}]::text[]`;
const sqlDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? `${sqlText(date.toISOString())}::timestamptz` : 'now()';
};

const response = await fetch(catalogUrl);
if (!response.ok) throw new Error(`Export Base44 non riuscito: HTTP ${response.status}`);
const exercises = await response.json();
if (!Array.isArray(exercises) || exercises.length === 0 || exercises.length >= 1000) {
  throw new Error('Risposta catalogo vuota o potenzialmente paginata; import annullato.');
}

const sourceIds = new Set();
for (const exercise of exercises) {
  if (!exercise.id || sourceIds.has(exercise.id)) throw new Error('ID sorgente mancante o duplicato; import annullato.');
  sourceIds.add(exercise.id);
  if (!exercise.name || !allowedCategories.has(exercise.macro_category) || !allowedDifficulties.has(exercise.difficulty)) {
    throw new Error(`Record non valido nel catalogo Base44 (${exercise.id}); import annullato.`);
  }
}

const columns = [
  'source_base44_id', 'title', 'name', 'category', 'macro_category', 'subcategory',
  'description', 'muscle_groups', 'equipment', 'difficulty', 'setup_instructions',
  'common_mistakes', 'image_url', 'demo_video_url', 'is_sample', 'created_at', 'updated_at',
];
const values = exercises.map((exercise) => `(${[
  sqlText(exercise.id),
  sqlText(exercise.name),
  sqlText(exercise.name),
  sqlText(exercise.macro_category),
  sqlText(exercise.macro_category),
  sqlText(exercise.subcategory),
  sqlText(exercise.description),
  sqlArray(exercise.muscle_groups),
  sqlText(exercise.equipment),
  sqlText(exercise.difficulty),
  sqlText(exercise.setup_instructions),
  sqlArray(exercise.common_mistakes),
  sqlText(exercise.image_url),
  sqlText(exercise.demo_video_url),
  exercise.is_sample === true ? 'true' : 'false',
  sqlDate(exercise.created_date),
  sqlDate(exercise.updated_date),
].join(', ')})`);

const updates = columns.slice(1).map((column) => `${column} = excluded.${column}`).join(',\n  ');
const sql = `insert into public.exercises (${columns.join(', ')})\nvalues\n${values.join(',\n')}\non conflict (source_base44_id) where source_base44_id is not null\ndo update set ${updates};\n`;

const tempDirectory = mkdtempSync(join(tmpdir(), 'moveer-exercises-'));
const sqlFile = join(tempDirectory, 'import.sql');
try {
  writeFileSync(sqlFile, sql, { mode: 0o600 });
  execFileSync('./node_modules/.bin/supabase', ['db', 'query', '--linked', '--file', sqlFile], { stdio: 'inherit' });
  console.log(`Import completato: ${exercises.length} esercizi verificati e sincronizzati.`);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}