import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nell'ambiente prima della migrazione.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const bucket = 'public-assets';
const pageSize = 500;
const maxImageSize = 10 * 1024 * 1024;
const supportedImageTypes = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/svg+xml', 'svg'],
  ['image/webp', 'webp'],
]);
const mediaColumns = [
  { table: 'exercises', column: 'image_url' },
  { table: 'profiles', column: 'logo_url' },
];

function getLegacyMediaUrl(value) {
  if (typeof value !== 'string' || !value) return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.hostname !== 'media.base44.com') return null;
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('URL media Base44 non sicuro.');
  }
  return url;
}

async function downloadImage(url, recordLabel) {
  let requestUrl = url;
  let response;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    response = await fetch(requestUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status < 300 || response.status >= 400) break;

    const location = response.headers.get('location');
    if (!location) throw new Error(`Redirect immagine senza destinazione (${recordLabel}).`);
    const redirectUrl = new URL(location, requestUrl);
    if (
      redirectUrl.hostname !== url.hostname ||
      redirectUrl.protocol !== 'https:' ||
      redirectUrl.username ||
      redirectUrl.password ||
      (redirectUrl.port && redirectUrl.port !== '443')
    ) {
      throw new Error(`Redirect immagine verso un host non autorizzato (${recordLabel}).`);
    }
    requestUrl = redirectUrl;
  }
  if (!response || (response.status >= 300 && response.status < 400)) {
    throw new Error(`Troppi redirect nel download dell'immagine (${recordLabel}).`);
  }
  if (!response.ok) {
    throw new Error(`Download immagine non riuscito: HTTP ${response.status} (${recordLabel}).`);
  }

  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  const extension = supportedImageTypes.get(contentType);
  if (!extension) {
    throw new Error(`Formato immagine non supportato (${contentType || 'sconosciuto'}) (${recordLabel}).`);
  }

  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > maxImageSize) {
    throw new Error(`Immagine oltre il limite di 10 MB (${recordLabel}).`);
  }

  if (!response.body) throw new Error(`Risposta senza contenuto immagine (${recordLabel}).`);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxImageSize) {
      await reader.cancel();
      throw new Error(`Immagine oltre il limite di 10 MB (${recordLabel}).`);
    }
    chunks.push(value);
  }

  return { body: Buffer.concat(chunks), contentType, extension };
}

async function migrateColumn({ table, column }) {
  let offset = 0;
  let migrated = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .order('id')
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!rows.length) break;

    for (const row of rows) {
      const url = getLegacyMediaUrl(row[column]);
      if (!url) continue;

      const recordLabel = `${table}/${row.id}`;
      const { body, contentType, extension } = await downloadImage(url, recordLabel);
      const objectPath = `migrated/${table}/${row.id}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, body, {
        contentType,
        cacheControl: '31536000',
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
      const { data: updated, error: updateError } = await supabase
        .from(table)
        .update({ [column]: publicUrl })
        .eq('id', row.id)
        .eq(column, row[column])
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error(`Record ${recordLabel} è cambiato durante la migrazione.`);

      migrated += 1;
      console.log(`Migrato ${table}/${row.id}`);
    }

    offset += rows.length;
    if (rows.length < pageSize) break;
  }

  return migrated;
}

let totalMigrated = 0;
for (const mediaColumn of mediaColumns) {
  totalMigrated += await migrateColumn(mediaColumn);
}

console.log(`Migrazione completata: ${totalMigrated} immagini trasferite in Supabase Storage.`);
