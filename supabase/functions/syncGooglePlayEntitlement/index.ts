import { authenticate, enforceRateLimit, handle, HttpError, json, readJson } from '../_shared/runtime.ts';
import { syncGooglePlayEntitlement } from '../_shared/googlePlayBilling.ts';

Deno.serve(handle('syncGooglePlayEntitlement', async (req) => {
  const body = await readJson(req);
  const auth = await authenticate(req);
  if (!auth) throw new HttpError(401, 'Accesso richiesto');
  await enforceRateLimit(`syncGooglePlayEntitlement:${auth.user.id}`, 20, 60 * 60);

  const purchaseToken = body.purchaseToken;
  const productId = body.productId;
  if (purchaseToken !== undefined && (typeof purchaseToken !== 'string' || !purchaseToken.trim())) {
    throw new HttpError(400, 'Token Google Play non valido');
  }
  if (productId !== undefined && (typeof productId !== 'string' || !productId.trim())) {
    throw new HttpError(400, 'Prodotto Google Play non valido');
  }
  if (productId && !purchaseToken) {
    throw new HttpError(400, 'Il prodotto richiede un token Google Play');
  }

  return json(await syncGooglePlayEntitlement(
    auth.user.id,
    typeof purchaseToken === 'string' ? purchaseToken.trim() : undefined,
    typeof productId === 'string' ? productId.trim() : undefined,
  ));
}));
