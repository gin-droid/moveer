import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const maxRequestBytes = 6 * 1024 * 1024;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

function allowedOrigins() {
  const configured = (Deno.env.get('APP_ORIGIN') || 'https://app.moveer.eu')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  return new Set([...configured, 'capacitor://localhost', 'https://localhost']);
}

function corsHeaders(req: Request) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  });
  const origin = req.headers.get('Origin');
  if (origin && allowedOrigins().has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function handle(
  scope: string,
  handler: (req: Request) => Promise<Response> | Response,
  options: { cors?: boolean } = {},
) {
  return async (req: Request) => {
    const headers = options.cors === false ? new Headers() : corsHeaders(req);
    const respond = (response: Response) => {
      const merged = new Headers(response.headers);
      headers.forEach((value, key) => merged.set(key, value));
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
    };

    if (req.method === 'OPTIONS') return respond(new Response(null, { status: 204 }));
    if (req.method !== 'POST') return respond(json({ error: 'Metodo non supportato' }, 405));
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > maxRequestBytes) return respond(json({ error: 'Richiesta troppo grande' }, 413));

    try {
      return respond(await handler(req));
    } catch (error) {
      if (error instanceof HttpError) return respond(json({ error: error.message }, error.status));
      console.error(`${scope}:`, error);
      return respond(json({ error: 'Errore interno. Riprova più tardi.' }, 500));
    }
  };
}

export async function readJson(req: Request, maxBytes = maxRequestBytes): Promise<Record<string, unknown>> {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new HttpError(413, 'Richiesta troppo grande');
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, 'Richiesta troppo grande');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'JSON non valido');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Il corpo deve essere un oggetto JSON');
  }
  return value as Record<string, unknown>;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function requireAdmin(auth: { client: SupabaseClient; user: User }) {
  const { data, error } = await auth.client.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
  if (error) throw error;
  if (data?.role !== 'admin') throw new HttpError(403, 'Permessi amministratore richiesti');
  return auth;
}

export async function enforceRateLimit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await adminClient.rpc('check_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  if (!data) throw new HttpError(429, 'Troppe richieste. Riprova più tardi.');
}

export function fetchWithTimeout(input: string | URL | Request, init: RequestInit = {}, timeoutMs = 20_000) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

export async function authenticate(req: Request): Promise<{
  client: SupabaseClient;
  user: User;
} | null> {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return { client, user };
}

export async function consumeQuota(client: SupabaseClient, kind: 'analysis' | 'mentor') {
  const { data, error } = await client.rpc('consume_monthly_quota', { p_kind: kind });
  if (error) throw error;
  return data as { allowed: boolean; blocked: boolean; used: number; limit: number; plan: string };
}

export async function generateGeminiText(
  contents: unknown[],
  systemInstruction?: string,
  jsonResponse = true,
  jsonSchema?: unknown,
) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY non configurata nei secrets Supabase');
  const configuredModel = (Deno.env.get('GEMINI_MODEL') || '').trim().replace(/^models\//, '');
  const model = !configuredModel || configuredModel === 'gemini-2.5-flash'
    ? 'gemini-3.8-flash'
    : configuredModel;
  type GeminiImage = { mimeType?: string; mime_type?: string; data?: string };
  type GeminiPart = {
    text?: string;
    inlineData?: GeminiImage;
    inline_data?: GeminiImage;
  };
  type GeminiTurn = { role?: string; parts?: GeminiPart[] };
  type InteractionContent =
    | { type: 'text'; text: string }
    | { type: 'image'; mime_type: string; data: string };
  const turns = contents as GeminiTurn[];
  const toInteractionContent = (parts: GeminiPart[] = []): InteractionContent[] => parts.flatMap<InteractionContent>((part) => {
    if (typeof part.text === 'string') return [{ type: 'text', text: part.text }];
    const image = part.inlineData || part.inline_data;
    if (image?.data) {
      const mimeType = (typeof image.mimeType === 'string' ? image.mimeType : undefined) ||
        (typeof image.mime_type === 'string' ? image.mime_type : undefined) || 'image/jpeg';
      return [{
        type: 'image',
        mime_type: mimeType,
        data: image.data,
      }];
    }
    return [];
  });
  const input = turns.length === 1 && turns[0].role !== 'model'
    ? toInteractionContent(turns[0].parts)
    : turns.map((turn) => ({
      type: turn.role === 'model' ? 'model_output' : 'user_input',
      content: toInteractionContent(turn.parts),
    }));
  const models = model === 'gemini-3.8-flash'
    ? [model, 'gemini-3.7-flash', 'gemini-3.5-flash']
    : [model];

  for (const [index, currentModel] of models.entries()) {
    const response = await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: currentModel,
        input,
        store: false,
        ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
        generation_config: { temperature: 0.35 },
        ...(jsonResponse ? {
          response_format: [{
            type: 'text',
            mime_type: 'application/json',
            ...(jsonSchema ? { schema: jsonSchema } : {}),
          }],
        } : {}),
      }),
    }, 90_000);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result.error?.message || `Errore Interactions API HTTP ${response.status}`;
      const temporaryCapacityError = [408, 429, 500, 502, 503, 504].includes(response.status) ||
        /high demand|overload(?:ed)?|temporarily unavailable|capacity/i.test(message);
      if (temporaryCapacityError && index < models.length - 1) {
        console.warn(`Gemini ${currentModel} temporarily unavailable; trying fallback model.`);
        continue;
      }
      throw new Error(message);
    }
    const text = typeof result.output_text === 'string'
      ? result.output_text
      : (Array.isArray(result.steps) ? result.steps : [])
        .filter((step: { type?: string }) => step.type === 'model_output')
        .flatMap((step: { content?: Array<{ type?: string; text?: string }> }) => step.content || [])
        .filter((item: { type?: string; text?: string }) => item.type === 'text' && typeof item.text === 'string')
        .map((item: { text: string }) => item.text)
        .join('');
    if (!text) throw new Error('Risposta Gemini vuota');
    return text;
  }

  throw new Error('Nessun modello Gemini disponibile');
}

export function parseGeminiJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

export async function sendBrevoEmail(to: string | string[], subject: string, text: string) {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) throw new Error('BREVO_API_KEY ed EMAIL_FROM devono essere configurate nei secrets Supabase');
  const recipients = (Array.isArray(to) ? to : [to]).map((email) => ({ email }));
  const response = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: Deno.env.get('EMAIL_FROM_NAME') || 'moVeerAI', email: from },
      to: recipients,
      subject,
      textContent: text,
    }),
  }, 30_000);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Brevo email API HTTP ${response.status}`);
  return result;
}