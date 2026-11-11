import { adminClient } from './runtime.ts';

export async function deleteUserStorage(userId: string) {
  const { data, error } = await adminClient.rpc('list_user_storage_objects', { p_user_id: userId });
  if (error) throw error;

  const objects = (data || []) as Array<{ bucket_id: string; name: string }>;
  for (const bucketId of ['analysis-media', 'public-assets']) {
    const names = objects.filter((object) => object.bucket_id === bucketId).map((object) => object.name);
    for (let offset = 0; offset < names.length; offset += 100) {
      const { error: removeError } = await adminClient.storage.from(bucketId).remove(names.slice(offset, offset + 100));
      if (removeError) throw removeError;
    }
  }
}